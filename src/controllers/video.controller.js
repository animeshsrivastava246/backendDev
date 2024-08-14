import mongoose, { isValidObjectId } from "mongoose";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { uploadCloudinary, deleteCloudinary } from "../utils/cloudinary.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import User from "../models/user.model.js";
import { Video } from "../models/video.model.js";

// get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    // console.log(userId);
    const pipeline = [];
    /*
    For using Full Text based search u need to create a search index in mongoDB atlas.
    You can include field mapppings in search index eg.title, description, as well.
    Field mappings specify which fields within your documents should be indexed for text search.
    This helps in seraching only in title, desc providing faster search results.
    Here the name of search index is 'search-videos'
    */
    if (query)
        pipeline.push({
            $search: {
                index: "search-videos",
                text: {
                    query: query,
                    path: ["title", "description"], //search only on title, desc
                },
            },
        });
    if (userId) {
        if (!isValidObjectId(userId)) throw new ApiError(400, "userId Invalid");
        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId.cacheHexString(userId),
                // owner: new mongoose.Types.ObjectId(userId) // use this if above does not work
            },
        });
    }
    // fetch videos only that are set isPublished as true
    pipeline.push({ $match: { isPublished: true } });

    //sortBy can be views, createdAt, duration //sortType can be ascending(-1) or descending(1)
    if (sortBy && sortType)
        pipeline.push({ $sort: { [sortBy]: sortType === "asc" ? 1 : -1 } });
    else pipeline.push({ $sort: { createdAt: -1 } });

    pipeline.push(
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                        },
                    },
                ],
            },
        },
        { $unwind: "$ownerDetails" }
    );
    const videoAggregate = Video.aggregate(pipeline);
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };
    const video = await Video.aggregatePaginate(videoAggregate, options);
    return res
        .status(200)
        .json(new ApiResponse(200, video, "Successfully Fetched Videos"));
});

// get video, upload to cloudinary, create video
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    if ([title, description].some((field) => field?.trim() === ""))
        throw new ApiError(400, "All Fields Required");
    const videoFileLocalPath = req.files?.videoFile[0].path;
    const thumbnailLocalPath = req.files?.thumbnail[0].path;
    if (!videoFileLocalPath)
        throw new ApiError(400, "videoFileLocalPath Required");
    if (!thumbnailLocalPath)
        throw new ApiError(400, "thumbnailLocalPath Required");
    const videoFile = await uploadCloudinary(videoFileLocalPath);
    const thumbnail = await uploadCloudinary(thumbnailLocalPath);
    if (!videoFile) throw new ApiError(400, "Video File Not Found");
    if (!thumbnail) throw new ApiError(400, "Thumbnail Not Found");
    const video = await Video.create({
        title,
        description,
        duration: videoFile.duration,
        videoFile: {
            url: videoFile.url,
            public_id: videoFile.public_id,
        },
        thumbnail: {
            url: thumbnail.url,
            public_id: thumbnail.public_id,
        },
        owner: req.user?._id,
        isPublished: false,
    });
    const videoUploaded = await Video.findById(video._id);
    if (!videoUploaded)
        throw new ApiError(500, "videoUpload Failed:: publishAVideo");
    return res
        .status(200)
        .json(new ApiResponse(200, video, "Successfully Uploaded Video"));
});

// get video by id
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    // let userId = req.body;

    // userId = new mongoose.Types.ObjectId(userId)
    if (!isValidObjectId(videoId)) throw new ApiError(400, "videoId Invalid");
    if (!isValidObjectId(req.user?._id))
        throw new ApiError(400, "userId Invalid");
    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId.cacheHexString(videoId),
                // _id: new mongoose.Types.ObjectId(videoId) // use this if aboove does not work
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes",
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribers",
                        },
                    },
                    {
                        $addFields: {
                            subscribersCount: { $size: "$subscribers" },
                            isSubscribed: {
                                $cond: {
                                    if: {
                                        $in: [
                                            req.user?._id,
                                            "$subscribers.subscriber",
                                        ],
                                    },
                                    then: true,
                                    else: false,
                                },
                            },
                        },
                    },
                    {
                        $project: {
                            username: 1,
                            "avatar.url": 1,
                            subscribersCount: 1,
                            isSubscribed: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                likesCount: { $size: "$likes" },
                owner: { $first: "$owner" },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likes.likedBy"] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                "videoFile.url": 1,
                title: 1,
                description: 1,
                views: 1,
                createdAt: 1,
                duration: 1,
                comments: 1,
                owner: 1,
                likesCount: 1,
                isLiked: 1,
            },
        },
    ]);
    if (!video) throw new ApiError(500, "Video Fetching Failed");
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } }); // increment views if video fetched successfully
    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet: { watchHistory: videoId },
    }); // add this video to user watch history

    return res
        .status(200)
        .json(
            new ApiResponse(200, video[0], "Successfully Fetched Video Details")
        );
});

// update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) throw new ApiError(400, "videoId Invalid");
    if (!(title && description))
        throw new ApiError(400, "Title and Description Required");
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video Not Found");
    if (video?.owner.toString() !== req.user?._id.toString())
        throw new ApiError(400, "Owner only can Update their Video");
    //deleting old thumbnail and updating with new one
    const thumbnailToDelete = video.thumbnail.public_id;
    const thumbnailLocalPath = req.file?.path;
    if (!thumbnailLocalPath) throw new ApiError(400, "Thumbnail Required");
    const thumbnail = await uploadCloudinary(thumbnailLocalPath);
    if (!thumbnail) throw new ApiError(400, "Thumbnail Not Found");
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description,
                thumbnail: {
                    public_id: thumbnail.public_id,
                    url: thumbnail.url,
                },
            },
        },
        { new: true }
    );
    if (!updatedVideo)
        throw new ApiError(500, "Video Updation Failed :: updateVideo");
    if (updatedVideo) await deleteCloudinary(thumbnailToDelete);
    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Successfully Updated Video"));
});

// delete video
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) throw new ApiError(400, "videoId Invalid");
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video Not Found");
    if (video?.owner.toString() !== req.user?._id.toString())
        throw new ApiError(400, "Owner only can Delete their Video");
    const videoDeleted = await Video.findByIdAndDelete(video?._id);
    if (!videoDeleted)
        throw new ApiError(400, "Video Deletion Failed :: deleteVideo");
    await deleteCloudinary(video.thumbnail.public_id); // video model has thumbnail public_id stored in it->check videoModel
    await deleteCloudinary(video.videoFile.public_id, "video"); // specify video while deleting video
    await Like.deleteMany({ video: videoId }); // delete video likes
    await Comment.deleteMany({ video: videoId }); // delete video comments
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Successfully Deleted Video"));
});

// toggle publish status of a video
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) throw new ApiError(400, "videoId Invalid");
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video Not Found");
    if (video?.owner.toString() !== req.user?._id.toString())
        throw new ApiError(400, "Owner only can toggle Publish Status");
    const toggledVideoPublish = await Video.findByIdAndUpdate(
        videoId,
        { $set: { isPublished: !video?.isPublished } },
        { new: true }
    );
    if (!toggledVideoPublish)
        throw new ApiError(
            500,
            "Video Publish Status Toggle Failed :: togglePublishStatus"
        );
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { isPublished: toggledVideoPublish.isPublished },
                "Successfully Toggled Video Publish Status"
            )
        );
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};

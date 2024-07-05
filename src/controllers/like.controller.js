import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId))
        throw new ApiError(400, "videoId Invalid :: toggleVideoLike");
    const likedAlready = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id,
    });
    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);
        return res.status(200).json(new ApiResponse(200, { isLiked: false }));
    }
    await Like.create({
        video: videoId,
        likedBy: req.user?._id,
    });
    return res.status(200).json(new ApiResponse(200, { isLiked: true }));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if (!isValidObjectId(commentId))
        throw new ApiError(400, "commentId Invalid :: toggleCommentLike");
    const likedAlready = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id,
    });
    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);
        return res.status(200).json(new ApiResponse(200, { isLiked: false }));
    }
    await Like.create({
        comment: commentId,
        likedBy: req.user?._id,
    });
    return res.status(200).json(new ApiResponse(200, { isLiked: true }));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    if (!isValidObjectId(tweetId))
        throw new ApiError(400, "tweetId Invalid :: toggleTweetLike");
    const likedAlready = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id,
    });
    if (likedAlready) {
        await Like.findByIdAndDelete(likedAlready?._id);
        return res
            .status(200)
            .json(new ApiResponse(200, { tweetId, isLiked: false }));
    }
    await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id,
    });
    return res.status(200).json(new ApiResponse(200, { isLiked: true }));
});

const getLikedVideos = asyncHandler(async (req, res) => {
    const likedVideosAggegate = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId.cacheHexString(
                    req.user?._id
                ),
                // likedBy: new mongoose.Types.ObjectId(req.user?._id) // use this if above does not work
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideo",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerDetails",
                        },
                    },
                    { $unwind: "$ownerDetails" },
                ],
            },
        },
        { $unwind: "$likedVideo" },
        { $sort: { createdAt: -1 } },
        {
            $project: {
                _id: 0,
                likedVideo: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    owner: 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    isPublished: 1,
                    ownerDetails: {
                        username: 1,
                        fullName: 1,
                        "avatar.url": 1,
                    },
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                likedVideosAggegate,
                "Successfully Fetched Liked Videos"
            )
        );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };

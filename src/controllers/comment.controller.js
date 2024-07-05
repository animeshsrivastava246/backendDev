import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const video = await Video.findById(videoId);

    if (!video) throw new ApiError(404, "Video not found");

    const commentsAggregate = Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId.cacheHexString(videoId),
                // video: new mongoose.Types.ObjectId(videoId), //use this if above does not work
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes",
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
        { $sort: { createdAt: -1 } },
        {
            $project: {
                content: 1,
                createdAt: 1,
                likesCount: 1,
                owner: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                },
                isLiked: 1,
            },
        },
    ]);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };

    const comments = await Comment.aggregatePaginate(
        commentsAggregate,
        options
    );

    return res
        .status(200)
        .json(new ApiResponse(200, comments, "Successfully Fetched Comments"));
});

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    if (!content) throw new ApiError(400, "Content Required");

    const video = await Video.findById(videoId);

    if (!video) throw new ApiError(404, "No Video Found");

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id,
    });

    if (!comment)
        throw new ApiError(
            500,
            "Comment Not Added :: addComment :: comment controller"
        );

    return res
        .status(201)
        .json(new ApiResponse(201, comment, "Successfully Added Comment"));
});

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) throw new ApiError(400, "Content Required");

    const comment = await Comment.findById(commentId);

    if (!comment) throw new ApiError(404, "No Comment Found");

    if (comment?.owner.toString() !== req.user?._id.toString())
        throw new ApiError(400, "Not Comment Owner");

    const updatedComment = await Comment.findByIdAndUpdate(
        comment?._id,
        { $set: { content } },
        { new: true }
    );

    if (!updatedComment)
        throw new ApiError(
            500,
            "Comment Not Updated :: updateComment :: comment controller"
        );

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedComment, "Successfully Edited Comment")
        );
});

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);

    if (!comment) throw new ApiError(404, "No Comment Found");

    if (comment?.owner.toString() !== req.user?._id.toString())
        throw new ApiError(400, "Not Comment Owner");

    await Comment.findByIdAndDelete(commentId);
    await Like.deleteMany({
        comment: commentId,
        likedBy: req.user,
    });

    return res
        .status(200)
        .json(
            new ApiResponse(200, { commentId }, "Successfully Deleted Comment")
        );
});

export { getVideoComments, addComment, updateComment, deleteComment };

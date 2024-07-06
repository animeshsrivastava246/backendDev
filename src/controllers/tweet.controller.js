import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;
    if (!content) throw new ApiError(400, "Content Required");
    const tweet = await Tweet.create({
        content,
        owner: req.user?._id,
    });
    if (!tweet) throw new ApiError(500, "Tweet Creation Failed :: createTweet");
    return res
        .status(200)
        .json(new ApiResponse(200, tweet, "Successfully Created Tweet"));
});

const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) throw new ApiError(400, "userId Invalid");
    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId.cacheHexString(userId),
                // owner: new mongoose.Types.ObjectId(userId) // use this if above does not work
            },
        },
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
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "likeDetails",
                pipeline: [{ $project: { likedBy: 1 } }],
            },
        },
        {
            $addFields: {
                likesCount: { $size: "$likeDetails" },
                ownerDetails: { $first: "$ownerDetails" },
                isLiked: {
                    $cond: {
                        if: { $in: [req.user?._id, "$likeDetails.likedBy"] },
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
                ownerDetails: 1,
                likesCount: 1,
                createdAt: 1,
                isLiked: 1,
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, tweets, "Successfully Fetched Tweet"));
});

const updateTweet = asyncHandler(async (req, res) => {
    const { content } = req.body;
    const { tweetId } = req.params;
    if (!content) throw new ApiError(400, "Content Required");
    if (!isValidObjectId(tweetId)) throw new ApiError(400, "tweetId Invalid");
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) throw new ApiError(404, "Tweet Not Found");
    if (tweet?.owner.toString() !== req.user?._id.toString())
        throw new ApiError(400, "Owner only can Edit their Tweet");
    const newTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        { $set: { content } },
        { new: true }
    );
    if (!newTweet)
        throw new ApiError(500, "Tweet Editing Failed :: updateTweet");
    return res
        .status(200)
        .json(new ApiResponse(200, newTweet, "Successfully Updated Tweet"));
});

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    if (!isValidObjectId(tweetId)) throw new ApiError(400, "tweetId Invalid");
    const tweet = await Tweet.findById(tweetId);
    if (!tweet) throw new ApiError(404, "Tweet Not Found");
    if (tweet?.owner.toString() !== req.user?._id.toString())
        throw new ApiError(400, "Owner only can Delete their Tweet");
    await Tweet.findByIdAndDelete(tweetId);
    return res
        .status(200)
        .json(new ApiResponse(200, { tweetId }, "Successfully Deleted Tweet"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };

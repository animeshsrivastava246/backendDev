import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    if (!name || !description)
        throw new ApiError(400, "Name and Description Required");
    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user?._id,
    });
    if (!playlist) throw new ApiError(500, "Playlist Creation Failed");
    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Successfully Created Playlist"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId))
        throw new ApiError(400, "PlaylistId or videoId is Invalid");

    const playlist = await Playlist.findById(playlistId);
    const video = await Video.findById(videoId);

    if (!playlist) throw new ApiError(404, "Playlist Not Found");
    if (!video) throw new ApiError(404, "Video Not Found");
    if (
        (playlist.owner?.toString() && video.owner.toString()) !==
        req.user?._id.toString()
    )
        throw new ApiError(400, "Owner only can add Video to their Playlist");
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlist?._id,
        { $addToSet: { videos: videoId } },
        { new: true }
    );
    if (!updatedPlaylist) {
        throw new ApiError(
            400,
            "Failed adding Video to Playlist :: addVideoToPlaylist"
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedPlaylist,
                "Successfully added Video to Playlist"
            )
        );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;
    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId))
        throw new ApiError(400, "PlaylistId or videoId is Invalid");
    const playlist = await Playlist.findById(playlistId);
    const video = await Video.findById(videoId);
    if (!playlist) throw new ApiError(404, "Playlist Not Found");
    if (!video) throw new ApiError(404, "Video Not Found");
    if (
        (playlist.owner?.toString() && video.owner.toString()) !==
        req.user?._id.toString()
    )
        throw new ApiError(
            404,
            "Owner only can remove Video from their Playlist"
        );
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        { $pull: { videos: videoId } },
        { new: true }
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedPlaylist,
                "Successfully Removed Video from Playlist"
            )
        );
});

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    if (!isValidObjectId(playlistId))
        throw new ApiError(400, "PlaylistId Invalid");
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "Playlist Not Found");
    if (playlist.owner.toString() !== req.user?._id.toString())
        throw new ApiError(
            400,
            "Owner only can delete Video from their Playlist"
        );
    await Playlist.findByIdAndDelete(playlist?._id);
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Successfully Deleted Playlist"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;
    if (!name || !description)
        throw new ApiError(400, "Name and Description Required");
    if (!isValidObjectId(playlistId))
        throw new ApiError(400, "PlaylistId Invalid");
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "Playlist Not Found");
    if (playlist.owner.toString() !== req.user?._id.toString())
        throw new ApiError(400, "Owner only can edit their Playlist");
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlist?._id,
        {
            $set: {
                name,
                description,
            },
        },
        { new: true }
    );
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                updatedPlaylist,
                "Successfully Updated Playlist"
            )
        );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) throw new ApiError(400, "userId Invalid");
    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId.cacheHexString(userId),
                // owner: new mongoose.Types.ObjectId(userId) // use this if above does not work
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
            },
        },
        {
            $addFields: {
                totalVideos: { $size: "$videos" },
                totalViews: { $sum: "$videos.views" },
            },
        },
        {
            $project: {
                _id: 1,
                name: 1,
                description: 1,
                totalVideos: 1,
                totalViews: 1,
                updatedAt: 1,
            },
        },
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                playlists,
                "Successfully Fetched User Playlists"
            )
        );
});

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    if (!isValidObjectId(playlistId))
        throw new ApiError(400, "PlaylistId Invalid");
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) throw new ApiError(404, "Playlist Not Found");
    const playlistVideos = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId.cacheHexString(playlistId),
                // _id: new mongoose.Types.ObjectId(playlistId) // use this if above does not work
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
            },
        },
        { $match: { "videos.isPublished": true } },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            $addFields: {
                totalVideos: { $size: "$videos" },
                totalViews: { $sum: "$videos.views" },
                owner: { $first: "$owner" },
            },
        },
        {
            $project: {
                name: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1,
                totalVideos: 1,
                totalViews: 1,
                videos: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    createdAt: 1,
                    views: 1,
                },
                owner: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                },
            },
        },
    ]);
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                playlistVideos[0],
                "Successfully Fetched Playlist"
            )
        );
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist,
};

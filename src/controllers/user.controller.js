import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const options = {
    httpOnly: true,
    secure: true,
};

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating Access and Refresh Token"
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { email, fullName, username, password } = req.body;

    if (
        [email, fullName, username, password].some(
            (field) => field?.trim() === ""
        )
    )
        throw new ApiError(400, "Fill all required fields");

    const existedUser = await User.findOne({ $or: [{ username }, { email }] });

    if (existedUser) throw new ApiError(409, "User Already Exist");

    const avatarLocalPath = req.files?.avatar[0]?.path;

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    )
        coverImageLocalPath = req.files.coverImage[0].path;

    if (!avatarLocalPath) throw new ApiError(400, "Avatar is Required");

    const avatar = await uploadCloudinary(avatarLocalPath);
    const coverImage = await uploadCloudinary(coverImageLocalPath);

    if (!avatar) throw new ApiError(400, "Avatar File is Required");

    const user = await User.create({
        email,
        fullName,
        username: username.toLowerCase(),
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser)
        throw new ApiError(408, "Something went wrong, cannot create user");

    return res
        .status(201)
        .json(new ApiResponse(201, createdUser, "User created Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    if (!username && !email)
        throw new ApiError(400, "Username or Email Required");

    const user = await User.findOne({ $or: [{ username }, { email }] });

    if (!user) throw new ApiError(404, "User does not exist");

    const isPassValid = await user.isPasswordCorrect(password);
    if (!isPassValid) throw new ApiError(401, "Incorrect Credentials");

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { user: loggedInUser, accessToken, refreshToken },
                "User Logged In Successfull"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 }, // this removes the field from document
        },
        { new: true }
    );

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged Out Successfull"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const refToken = req.cookies?.refreshToken || req.body.refreshToken;
    if (!refToken) throw new ApiError(401, "Unauthorized Request");
    const decodedToken = jwt.verify(refToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);
    if (!user) throw new ApiError(402, "Invalid Refresh Token");
    if (refToken !== user?.refreshToken)
        throw new ApiError(401, "Used or Expired Refresh Token");
    try {
        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshToken(user._id);
        return res
            .status(200)
            .clearCookie("accessToken", accessToken, options)
            .clearCookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access Token Refreshed"
                )
            );
    } catch (error) {
        console.error("User Controller :: refreshAccessToken :: ", error);
        throw new ApiError(
            401,
            error?.message || "Invalid Refresh Token :: refreshAccessToken"
        );
    }
});

const changePassword = asyncHandler(async (req, res) => {
    const { oldPass, newPass } = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPass);
    if (!isPasswordCorrect) throw new ApiError(400, "Incorrect Password");
    user.password = newPass;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password Successfully Changed"));
});

const getCurrUser = asyncHandler(async (req, res) =>
    res
        .status(200)
        .json(
            new ApiResponse(200, req.user, "Successfully Fetched Current User")
        )
);

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;
    if (fullName && email) throw new ApiError(400, "All FIelds are Required");
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Successfully Updated Account"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    if (!avatarLocalPath) throw new ApiError(400, "Missing Avatar File");
    const avatar = await uploadCloudinary(avatarLocalPath);
    if (!avatar.url)
        throw new ApiError(400, "Avatar File is Required :: updateUserAvatar");
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar File Updatedd Successfully"));
});

const updateUserCoverImg = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath)
        throw new ApiError(400, "Missing Cover Image File");
    const coverImage = await uploadCloudinary(coverImageLocalPath);
    if (!coverImage.url)
        throw new ApiError(
            400,
            "Cover Image File is Required :: updateUserCoverImage"
        );
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Cover Image File Updatedd Successfully")
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    getCurrUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImg,
};

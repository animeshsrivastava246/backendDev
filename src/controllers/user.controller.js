import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
    const { email, fullName, username, password } = req.body;
    console.log(
        "email: ",
        email,
        "\nfullName: ",
        fullName,
        "\nusername: ",
        username,
        "\npassword: ",
        password
    );

    if (
        [email, fullName, username, password].some(
            (field) => field?.trim() === ""
        )
    )
        throw new ApiError(400, "Fill all required fields");
    const existedUser = await User.findOne({ $or: [{ username }, { email }] });

    if (existedUser) throw new ApiError(409, "User Already Exist");

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

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

export { registerUser };

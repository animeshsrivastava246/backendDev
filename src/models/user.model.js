import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: [true, "Username Required"],
            unique: true,
            index: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: [true, "E-mail Required"],
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullName: {
            type: String,
            required: [true, "Full Name Required"],
            trim: true,
            index: true,
        },
        avatar: {
            type: {
                public_id: String,
                url: String, // cloudinary url
            },
            required: true,
        },
        coverImage: {
            type: {
                public_id: String,
                url: String, // cloudinary url
            },
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,
                ref: "Video",
            },
        ],
        password: {
            type: String,
            required: [true, "Password Required"],
        },
        refreshToken: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    else {
        this.password = await bcrypt.hash(this.password, 10);
        return next();
    }
});

userSchema.methods = {
    isPasswordCorrect: async function (password) {
        return await bcrypt.compare(password, this.password);
    },
    generateAccessToken: function () {
        return jwt.sign(
            {
                _id: this._id,
                email: this.email,
                username: this.username,
                fullName: this.fullName,
            },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
        );
    },
    generateRefreshToken: function () {
        return jwt.sign({ _id: this._id }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
        });
    },
};

const User = mongoose.model("User", userSchema);

export default User;

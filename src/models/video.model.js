import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            type: {
                public_id: String,
                url: String, // cloudinary url
            },
            required: true,
        },
        thumbnail: {
            type: {
                public_id: String,
                url: String, // cloudinary url
            },
            reuired: true,
        },
        title: {
            type: String,
            reuired: true,
        },
        description: {
            type: String,
            reuired: true,
        },
        duration: {
            type: Number,
            reuired: true,
        },
        views: {
            type: Number,
            default: 0,
        },
        isPublished: {
            type: Boolean,
            default: false,
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true,
    }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);

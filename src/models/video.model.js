import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        videoFile: {
            type: String, // url
            required: true,
        },
        thumbnail: {
            type: String, // url
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
            default: true,
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

videoSchema.plugin(mongooseAggregatePaginate)

export default Video = mongoose.model("Video", videoSchema);

import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        else {
            const result = await cloudinary.uploader.upload(localFilePath, {
                resource_type: "auto",
            });
            // console.info("Cloudinary :: File Upload Success :: ", result.url);
            fs.unlinkSync(localFilePath); // remove locally saved temp file since upload success
            return result;
        }
    } catch (error) {
        console.error("Cloudinary :: Error Upload :: ", error);
        fs.unlinkSync(localFilePath); // remove locally saved temp file since upload failed
        return null;
    }
};

const deleteCloudinary = async (public_id, resource_type = "image") => {
    try {
        if (!public_id) return null;
        else {
            //delete file from cloudinary
            const result = await cloudinary.uploader.destroy(public_id, {
                resource_type: `${resource_type}`,
            });
            // console.info("Cloudinary :: File Delete Success");
            return result;
        }
    } catch (error) {
        console.error("Cloudinary :: Error Delete :: ", error);
        return null;
    }
};

export { uploadCloudinary, deleteCloudinary };

import mongoose from "mongoose";
import { DB_NAME } from "../constants";

const connectDB = async () => {
    try {
        await mongoose.connect();
    } catch (error) {
        console.error("MongoDB connection ERROR :: ", error);
        process.exit(1);
        // throw error;
    }
};

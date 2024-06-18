// require('dotenv').config({path: './env'})
import dotenv from "dotenv";
import connectDB from "./db/db.js";
import app from "./app.js";
dotenv.config({
    path: "./.env",
});
const port = process.env.PORT || 8000;
console.info("testing");
connectDB()
    .then(() => {
        app.on("error", (error) => {
            console.error("Unable to establish connection :: ", error);
            throw error;
        });
        app.listen(port, () => {
            console.info(`Server is running on port : ${port}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB Connection Failed :: ", error);
        throw error;
    });

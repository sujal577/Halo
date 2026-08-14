import mongoose from "mongoose";

// In-memory storage for users (fallback when MongoDB is not available)
let inMemoryUsers = [];

const database=async()=>{
    try{
        await mongoose.connect(process.env.MONGOOSE_CONNECTION, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
        });
        console.log("✓ Connected to DataBase");
    }catch (error) {
        console.log("✗ Database Connection Error:", error.message);
        console.log("⚠️ Using in-memory storage for development");
        // Don't throw error, allow server to start without DB
    }
}

export { inMemoryUsers };
export default database
import mongoose from "mongoose";

const connectDB = async () => {
    try {
        mongoose.connection.on('connected', ()=> console.log("Database connected successfully"));
        await mongoose.connect(`${process.env.MONGODB_URL}/linkora`);
    } catch (error) {
        console.log("MongoDB connection failed:", error.message);
        
    }
}

export default connectDB;

import mongoose from "mongoose";

const password = process.env.db_password;
if (!password) {
  throw new Error("MongoDB password not found in environment variables");
}

const MONGODB_URL = `mongodb+srv://amoorthattil:${password}@cluster0.3shfe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}
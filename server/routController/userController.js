import User from "../schema/userSchema.js";
import Call from "../schema/callSchema.js";
import { inMemoryUsers } from "../db/database.js";
import mongoose from "mongoose";

// In-memory calls fallback
export const inMemoryCalls = [];

// Helper function to check if MongoDB is connected
const isMongoConnected = () => {
  return mongoose.connection.readyState === 1;
};

export const getAllUsers = async (req, res) => {
  const currentUserID = req.user?._id || res.user?._conditions?._id || res.user?._id;
  if (!currentUserID) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    if (isMongoConnected()) {
      const users = await User.find(
        { _id: { $ne: currentUserID } },
        "profilepic email username fullname gender"
      );
      res.status(200).json({ success: true, users });
    } else {
      // Use in-memory storage
      const users = inMemoryUsers
        .filter((u) => u._id.toString() !== currentUserID.toString())
        .map((u) => ({
          _id: u._id,
          profilepic: u.profilepic,
          email: u.email,
          username: u.username,
          fullname: u.fullname,
          gender: u.gender,
        }));
      res.status(200).json({ success: true, users });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || error,
    });
  }
};

export const getUserByUsernameOrEmail = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ success: false, message: "Query is required." });

  try {
    if (isMongoConnected()) {
      const user = await User.findOne(
        { $or: [{ username: query }, { email: query }] },
        "fullname email username profilepic"
      );
      if (!user) return res.status(404).json({ success: false, message: "User not found." });
      res.status(200).json({ success: true, user });
    } else {
      // Use in-memory storage
      const user = inMemoryUsers.find(
        (u) => u.username === query || u.email === query
      );
      if (!user) return res.status(404).json({ success: false, message: "User not found." });
      res.status(200).json({ success: true, user });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    if (isMongoConnected()) {
      const user = await User.findById(id, "fullname email username gender profilepic");
      if (!user) return res.status(404).json({ success: false, message: "User not found." });
      res.status(200).json({ success: true, user });
    } else {
      // Use in-memory storage
      const user = inMemoryUsers.find((u) => u._id === id);
      if (!user) return res.status(404).json({ success: false, message: "User not found." });
      res.status(200).json({ success: true, user });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Invalid user ID." });
  }
};

export const getCallHistory = async (req, res) => {
  const currentUserID = req.user?._id || res.user?._conditions?._id || res.user?._id;
  if (!currentUserID) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    if (isMongoConnected()) {
      const calls = await Call.find({
        $or: [{ caller: currentUserID }, { receiver: currentUserID }],
      })
        .populate("caller", "username email profilepic fullname")
        .populate("receiver", "username email profilepic fullname")
        .sort({ createdAt: -1 })
        .limit(30);

      res.status(200).json({ success: true, calls });
    } else {
      const calls = inMemoryCalls
        .filter(
          (c) =>
            c.caller?._id?.toString() === currentUserID.toString() ||
            c.receiver?._id?.toString() === currentUserID.toString()
        )
        .slice(-30)
        .reverse();

      res.status(200).json({ success: true, calls });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || "Failed to fetch call history" });
  }
};
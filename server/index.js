import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import database from "./db/database.js";
import authRout from "./rout/authRout.js";
import userRout from "./rout/userRout.js";
import Call from "./schema/callSchema.js";

import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const server = createServer(app);

// Dynamic origin validator
const isOriginAllowed = () => {
  return true; // Allow all network origins, tunnels, and mobile clients
};

app.use(
  cors({
    origin: function (origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRout);
app.use("/api/user", userRout);

app.get("/ok", (req, res) => {
  res.json({ status: "ok", message: "VideoCall server is running smoothly" });
});

const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: (origin, callback) => {
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

console.log("[SUCCESS] Socket.io initialized with multi-device CORS");

let onlineUsers = []; // Array of { userId, name, socketId, profilepic }
const activeCalls = new Map(); // Key: userId -> { partnerId, startTime, isCaller }
const randomQueue = []; // Queue of users waiting for random matchmaking: [{ socketId, userId, name, profilepic }]
const rooms = new Map(); // roomId -> Set of socketIds

// Helper to save call logs in MongoDB
const saveCallLog = async ({ caller, receiver, status, duration, startedAt, endedAt }) => {
  try {
    if (mongoose.connection.readyState === 1 && caller && receiver) {
      await Call.create({
        caller,
        receiver,
        status: status || "connected",
        duration: Math.round(duration || 0),
        startedAt: startedAt || new Date(),
        endedAt: endedAt || new Date(),
      });
      console.log(`[CALL LOG] Saved ${status} call: ${caller} -> ${receiver} (${duration || 0}s)`);
    }
  } catch (err) {
    console.error("Error saving call log:", err.message);
  }
};

// 📞 Handle WebSocket (Socket.io) connections
io.on("connection", (socket) => {
  console.log(`[INFO] New connection: ${socket.id}`);

  // Send socket ID to connected user
  socket.emit("me", socket.id);

  // 📡 User joins the chat & call system
  socket.on("join", (user) => {
    if (!user || !user.id) {
      console.warn("[WARNING] Invalid user data on join");
      return;
    }

    socket.join(user.id);
    const existingIndex = onlineUsers.findIndex((u) => u.userId === user.id);

    if (existingIndex !== -1) {
      onlineUsers[existingIndex].socketId = socket.id;
      onlineUsers[existingIndex].name = user.name || onlineUsers[existingIndex].name;
      if (user.profilepic) onlineUsers[existingIndex].profilepic = user.profilepic;
    } else {
      onlineUsers.push({
        userId: user.id,
        name: user.name,
        socketId: socket.id,
        profilepic: user.profilepic || "",
      });
    }

    io.emit("online-users", onlineUsers);
    console.log(`[JOIN] User ${user.name} (${user.id}) joined. Total online: ${onlineUsers.length}`);
  });

  // 📞 Initiate an outgoing call
  socket.on("callToUser", (data) => {
    console.log(`[CALL] Call initiated from ${data.name} (${data.from}) to ${data.callToUserId}`);
    const callee = onlineUsers.find((user) => user.userId === data.callToUserId);

    if (!callee) {
      socket.emit("userUnavailable", { message: "User is offline." });
      saveCallLog({
        caller: data.from,
        receiver: data.callToUserId,
        status: "missed",
        duration: 0,
      });
      return;
    }

    // Check if callee is already on another call
    if (activeCalls.has(data.callToUserId)) {
      socket.emit("userBusy", { message: "User is currently on another call." });
      io.to(callee.socketId).emit("incomingCallWhileBusy", {
        from: data.from,
        name: data.name,
        email: data.email,
        profilepic: data.profilepic,
      });
      saveCallLog({
        caller: data.from,
        receiver: data.callToUserId,
        status: "busy",
        duration: 0,
      });
      return;
    }

    // Forward incoming call offer to callee
    io.to(callee.socketId).emit("callToUser", {
      signal: data.signalData, // WebRTC SDP offer
      from: data.from, // Caller user ID
      name: data.name, // Caller name
      email: data.email, // Caller email
      profilepic: data.profilepic, // Caller avatar
    });
  });

  // 📞 Callee answers call
  socket.on("answeredCall", (data) => {
    console.log(`[CALL] Call answered by ${data.from} for caller ${data.to}`);
    const caller = onlineUsers.find((user) => user.userId === data.to);

    const startTime = Date.now();
    activeCalls.set(data.from, { partnerId: data.to, startTime, isCaller: false });
    activeCalls.set(data.to, { partnerId: data.from, startTime, isCaller: true });

    if (caller) {
      io.to(caller.socketId).emit("callAccepted", {
        signal: data.signal, // WebRTC SDP answer
        from: data.from, // Callee user ID
      });
    }
  });

  // ❄️ ICE Candidate exchange
  socket.on("ice-candidate", (data) => {
    const targetUser = onlineUsers.find((user) => user.userId === data.to);
    if (targetUser) {
      io.to(targetUser.socketId).emit("ice-candidate", {
        candidate: data.candidate,
        from: data.from,
      });
    }
  });

  // 💬 In-call real-time text messaging
  socket.on("call-message", (data) => {
    const targetUser = onlineUsers.find((user) => user.userId === data.to);
    if (targetUser) {
      io.to(targetUser.socketId).emit("call-message", {
        text: data.text,
        from: data.from,
        senderName: data.senderName,
        time: data.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }
  });

  // 🎲 RANDOM GLOBAL MATCHMAKING
  socket.on("find-random-peer", (userData) => {
    console.log(`[MATCHMAKING] User searching for random peer: ${userData.name} (${socket.id})`);

    // Remove if already in queue
    const queueIdx = randomQueue.findIndex((q) => q.socketId === socket.id);
    if (queueIdx !== -1) {
      randomQueue.splice(queueIdx, 1);
    }

    if (randomQueue.length > 0) {
      // Pair with waiting peer
      const matchedPeer = randomQueue.shift();
      console.log(`[MATCHMAKING] Pair created: ${matchedPeer.name} <---> ${userData.name}`);

      // User A (matchedPeer) will initiate the offer
      io.to(matchedPeer.socketId).emit("random-match-found", {
        partner: {
          userId: userData.id,
          name: userData.name,
          profilepic: userData.profilepic,
          socketId: socket.id,
        },
        isInitiator: true,
      });

      // User B (current user) will receive the offer
      socket.emit("random-match-found", {
        partner: {
          userId: matchedPeer.userId,
          name: matchedPeer.name,
          profilepic: matchedPeer.profilepic,
          socketId: matchedPeer.socketId,
        },
        isInitiator: false,
      });
    } else {
      // Put in queue
      randomQueue.push({
        socketId: socket.id,
        userId: userData.id,
        name: userData.name,
        profilepic: userData.profilepic,
      });
      socket.emit("random-searching");
    }
  });

  socket.on("leave-random-queue", () => {
    const queueIdx = randomQueue.findIndex((q) => q.socketId === socket.id);
    if (queueIdx !== -1) {
      randomQueue.splice(queueIdx, 1);
      console.log(`[MATCHMAKING] User left queue: ${socket.id}`);
    }
  });

  // 🔗 SHAREABLE MEETING ROOMS
  socket.on("join-room", ({ roomId, user }) => {
    socket.join(roomId);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(socket.id);

    console.log(`[ROOM] User ${user.name} joined room ${roomId}. Room size: ${rooms.get(roomId).size}`);

    // Notify other participants in the room
    socket.to(roomId).emit("user-joined-room", {
      socketId: socket.id,
      user,
    });

    // Send list of existing users to the newly joined user
    const existingUsers = Array.from(rooms.get(roomId)).filter((id) => id !== socket.id);
    socket.emit("room-existing-users", { users: existingUsers });
  });

  socket.on("room-signal", ({ toSocketId, signal, fromUser }) => {
    io.to(toSocketId).emit("room-signal", {
      fromSocketId: socket.id,
      signal,
      fromUser,
    });
  });

  socket.on("room-message", ({ roomId, text, senderName, from }) => {
    io.to(roomId).emit("room-message", {
      text,
      senderName,
      from,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  });

  // 🚫 Caller cancels before answer
  socket.on("cancel-call", (data) => {
    console.log(`[CALL] Call cancelled by caller ${data.from} to ${data.to}`);
    const callee = onlineUsers.find((user) => user.userId === data.to);
    if (callee) {
      io.to(callee.socketId).emit("callCancelled", {
        from: data.from,
      });
    }
    saveCallLog({
      caller: data.from,
      receiver: data.to,
      status: "cancelled",
      duration: 0,
    });
  });

  // ❌ Callee rejects call
  socket.on("reject-call", (data) => {
    console.log(`[CALL] Call rejected by ${data.from} to ${data.to}`);
    const caller = onlineUsers.find((user) => user.userId === data.to);
    if (caller) {
      io.to(caller.socketId).emit("callRejected", {
        from: data.from,
        name: data.name,
        profilepic: data.profilepic,
      });
    }
    saveCallLog({
      caller: data.to,
      receiver: data.from,
      status: "rejected",
      duration: 0,
    });
  });

  // 📴 Either peer ends an active call
  socket.on("call-ended", (data) => {
    console.log(`[CALL] Call ended by ${data.from} with partner ${data.to}`);
    const partner = onlineUsers.find((user) => user.userId === data.to);
    if (partner) {
      io.to(partner.socketId).emit("callEnded", {
        from: data.from,
        name: data.name,
      });
    }

    const callInfo = activeCalls.get(data.from) || activeCalls.get(data.to);
    if (callInfo) {
      const durationSeconds = Math.max(1, Math.round((Date.now() - callInfo.startTime) / 1000));
      const callerId = callInfo.isCaller ? data.from : data.to;
      const receiverId = callInfo.isCaller ? data.to : data.from;

      saveCallLog({
        caller: callerId,
        receiver: receiverId,
        status: "connected",
        duration: durationSeconds,
        startedAt: new Date(callInfo.startTime),
        endedAt: new Date(),
      });
    }

    activeCalls.delete(data.from);
    activeCalls.delete(data.to);
  });

  // ❌ Handle user disconnect
  socket.on("disconnect", () => {
    // Remove from random matchmaking queue
    const queueIdx = randomQueue.findIndex((q) => q.socketId === socket.id);
    if (queueIdx !== -1) {
      randomQueue.splice(queueIdx, 1);
    }

    // Clean up room memberships
    for (const [roomId, socketSet] of rooms.entries()) {
      if (socketSet.has(socket.id)) {
        socketSet.delete(socket.id);
        socket.to(roomId).emit("user-left-room", { socketId: socket.id });
        if (socketSet.size === 0) {
          rooms.delete(roomId);
        }
      }
    }

    const disconnectedUser = onlineUsers.find((u) => u.socketId === socket.id);

    if (disconnectedUser) {
      console.log(`[INFO] User disconnected: ${disconnectedUser.name} (${disconnectedUser.userId})`);

      // If user was in an active call, notify partner
      const callInfo = activeCalls.get(disconnectedUser.userId);
      if (callInfo) {
        const partner = onlineUsers.find((u) => u.userId === callInfo.partnerId);
        if (partner) {
          io.to(partner.socketId).emit("callEnded", {
            from: disconnectedUser.userId,
            name: disconnectedUser.name,
          });
        }
        const durationSeconds = Math.max(1, Math.round((Date.now() - callInfo.startTime) / 1000));
        const callerId = callInfo.isCaller ? disconnectedUser.userId : callInfo.partnerId;
        const receiverId = callInfo.isCaller ? callInfo.partnerId : disconnectedUser.userId;
        saveCallLog({
          caller: callerId,
          receiver: receiverId,
          status: "connected",
          duration: durationSeconds,
          startedAt: new Date(callInfo.startTime),
          endedAt: new Date(),
        });
        activeCalls.delete(disconnectedUser.userId);
        activeCalls.delete(callInfo.partnerId);
      }

      onlineUsers = onlineUsers.filter((u) => u.socketId !== socket.id);
      io.emit("online-users", onlineUsers);
      socket.broadcast.emit("disconnectUser", { disUser: socket.id, userId: disconnectedUser.userId });
    }
  });
});

(async () => {
  try {
    await database();
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server is running on port ${PORT} on all network interfaces`);
    });
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`⚠️ Server is running on port ${PORT} (without database)`);
    });
  }
})();
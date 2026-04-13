const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");

// Models
const User = require("./models/User");
const Message = require("./models/Message");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/Global chatchatchat",
  )
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    console.log(
      "💡 TIP: Ensure MongoDB is running locally or provide a connection string in server/.env",
    );
  });

// API Routes (for RTK Query)

// 1. User Registration
app.post("/api/users/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ error: "Username, email and password are required" });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      online: true,
    });

    // Don't send password back to client
    const userObj = newUser.toObject();
    delete userObj.password;

    res.status(201).json(userObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. User Login
app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    let user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    user.online = true;
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json(userObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get All Users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().sort({ username: 1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update User Profile
app.put("/api/users/:id", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username)
      return res.status(400).json({ error: "Username is required" });

    const existing = await User.findOne({
      username,
      _id: { $ne: req.params.id },
    });
    if (existing)
      return res.status(400).json({ error: "Username already taken" });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username },
      { new: true },
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const userObj = user.toObject();
    delete userObj.password;
    res.status(200).json(userObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Get Recent Global Messages
app.get("/api/messages", async (req, res) => {
  try {
    const messages = await Message.find({ recipient: null })
      .populate("sender", "username")
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Get Direct Messages between two users
app.get("/api/messages/direct/:userId/:otherId", async (req, res) => {
  try {
    const { userId, otherId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: otherId },
        { sender: otherId, recipient: userId },
      ],
    })
      .populate("sender", "username")
      .sort({ createdAt: 1 });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO Logic
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("user_join", async (userId) => {
    socket.userId = userId;
    socket.join(userId); // Join personal room for DMs
    const user = await User.findByIdAndUpdate(
      userId,
      { online: true },
      { new: true },
    );
    io.emit("user_status_change", {
      userId,
      username: user ? user.username : "Unknown",
      online: true,
    });
    console.log(`User ${userId} joined and joined room ${userId}`);
  });

  socket.on("send_message", async (data) => {
    try {
      const { sender, text, recipient } = data;
      const newMessage = await Message.create({ sender, text, recipient });
      const populatedMessage = await newMessage.populate("sender", "username");
      
      if (recipient) {
        // Direct Message: Emit to both recipient room and sender room
        io.to(recipient).to(sender).emit("receive_message", populatedMessage);
      } else {
        // Global Message: Broadcast to everyone
        io.emit("receive_message", populatedMessage);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("typing_start", (data) => {
    if (data.recipient) {
      io.to(data.recipient).emit("user_typing_start", data);
    } else {
      socket.broadcast.emit("user_typing_start", data);
    }
  });

  socket.on("typing_stop", (data) => {
    const userId = data.userId || data;
    const recipient = data.recipient || null;
    if (recipient) {
      io.to(recipient).emit("user_typing_stop", userId);
    } else {
      socket.broadcast.emit("user_typing_stop", userId);
    }
  });

  socket.on("disconnect", async () => {
    if (socket.userId) {
      const user = await User.findByIdAndUpdate(
        socket.userId,
        {
          online: false,
          lastSeen: Date.now(),
        },
        { new: true },
      );
      io.emit("user_status_change", {
        userId: socket.userId,
        username: user ? user.username : "Unknown",
        online: false,
      });
      console.log("User disconnected:", socket.userId);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Trigger nodemon restart

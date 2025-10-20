// import express from "express";
// import http from "http";
// import cors from "cors";
// import multer from "multer";
// import { Server } from "socket.io";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// app.use(cors());
// app.use(express.json());

// // Serve uploaded files
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// // Multer setup for file uploads
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
//   filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
// });
// const upload = multer({ storage });

// // Upload endpoint
// app.post("/upload", upload.single("music"), (req, res) => {
//   if (!req.file) return res.status(400).send("No file uploaded.");
//   res.json({ success: true, fileUrl: `/uploads/${req.file.filename}` });
// });

// // HTTP server + Socket.IO
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: "*" }
// });

// const rooms = new Map();

// io.on("connection", (socket) => {
//   console.log("✅ New connection:", socket.id);

//   socket.on("join-room", ({ roomId, userId, role }) => {
//     socket.join(roomId);
//     console.log(`🟢 ${userId} joined ${roomId} as ${role}`);

//     if (!rooms.has(roomId)) {
//       rooms.set(roomId, {
//         hostSocketId: role === "host" ? socket.id : null,
//         state: { isPlaying: false, playbackTime: 0 }
//       });
//     } else if (role === "host") {
//       rooms.get(roomId).hostSocketId = socket.id;
//     }

//     const state = rooms.get(roomId).state;
//     socket.emit("resync", { playbackTime: state.playbackTime, isPlaying: state.isPlaying });

//     io.to(roomId).emit("room-joined", { roomId, userId });
//   });

//   socket.on("host-play", ({ roomId, playbackTime }) => {
//     const r = rooms.get(roomId);
//     if (!r) return;
//     r.state.isPlaying = true;
//     r.state.playbackTime = playbackTime;
//     io.to(roomId).emit("sync-play", { playbackTime });
//   });

//   socket.on("host-pause", ({ roomId, playbackTime }) => {
//     const r = rooms.get(roomId);
//     if (!r) return;
//     r.state.isPlaying = false;
//     r.state.playbackTime = playbackTime;
//     io.to(roomId).emit("sync-pause", { playbackTime });
//   });

//   socket.on("host-seek", ({ roomId, playbackTime }) => {
//     const r = rooms.get(roomId);
//     if (!r) return;
//     r.state.playbackTime = playbackTime;
//     io.to(roomId).emit("sync-seek", { playbackTime });
//   });

//   socket.on("disconnect", () => console.log("❌ Disconnected:", socket.id));
// });

// const PORT = process.env.PORT || 4000;
// server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("✅ New connection:", socket.id);

  // 🔹 Create Room
  socket.on("create-room", ({ roomId, userId }) => {
    if (rooms.has(roomId)) {
      socket.emit("room-error", { message: "Room already exists!" });
      return;
    }

    rooms.set(roomId, {
      hostSocketId: socket.id,
      state: {
        isPlaying: false,
        playbackTime: 0,
        playbackRate: 1,
        updatedAt: Date.now(),
      },
    });

    socket.join(roomId);
    console.log(`🏠 Room created: ${roomId} by ${userId}`);
    socket.emit("room-created", { roomId });
  });

  // 🔹 Join Room
  socket.on("join-room", ({ roomId, userId, role }) => {
    if (!rooms.has(roomId)) {
      socket.emit("room-error", { message: "Room not found!" });
      return;
    }

    socket.join(roomId);
    console.log(`🟢 ${userId} joined ${roomId} as ${role}`);

    const r = rooms.get(roomId);
    if (role === "host") r.hostSocketId = socket.id;

    const state = r.state;
    socket.emit("resync", {
      playbackTime: state.playbackTime,
      serverTime: Date.now(),
      isPlaying: state.isPlaying,
    });

    io.to(roomId).emit("room-joined", { roomId, userId });
  });

  socket.on("host-play", ({ roomId, playbackTime }) => {
    const r = rooms.get(roomId);
    if (!r) return;
    r.state = { ...r.state, isPlaying: true, playbackTime };
    io.to(roomId).emit("sync-play", { playbackTime });
  });

  socket.on("host-pause", ({ roomId, playbackTime }) => {
    const r = rooms.get(roomId);
    if (!r) return;
    r.state = { ...r.state, isPlaying: false, playbackTime };
    io.to(roomId).emit("sync-pause", { playbackTime });
  });

  socket.on("host-seek", ({ roomId, playbackTime }) => {
    const r = rooms.get(roomId);
    if (!r) return;
    r.state = { ...r.state, playbackTime };
    io.to(roomId).emit("sync-seek", { playbackTime });
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

app.get("/", (req, res) => res.send("🎵 MusicSync Server Running!"));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

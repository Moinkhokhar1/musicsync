import express from "express";
import http from "http";
import cors from "cors";
import multer from "multer";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("✅ New connection:", socket.id);

  socket.on("create-room", ({ roomId, userId }) => {
    if (rooms.has(roomId)) {
      socket.emit("room-error", { message: "Room already exists!" });
      return;
    }

    rooms.set(roomId, {
      hostSocketId: socket.id,
      currentFile: null,
      state: {
        isPlaying: false,
        playbackTime: 0,
        playbackRate: 1,
        updatedAt: Date.now(),
      },
    });

    socket.join(roomId);
    socket.emit("room-created", { roomId });
    console.log(`🏠 Room created: ${roomId}`);
  });

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
      isPlaying: state.isPlaying,
      fileUrl: r.currentFile,
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
});

app.post("/upload", upload.single("audio"), (req, res) => {
  const filePath = `/uploads/${req.file.filename}`;
  console.log("🎵 Uploaded file:", filePath);
  res.json({ fileUrl: filePath });
});

// 🔹 Socket event for file share
app.post("/notify-file", (req, res) => {
  const { roomId, fileUrl } = req.body;
  const r = rooms.get(roomId);
  if (r) {
    r.currentFile = fileUrl;
    io.to(roomId).emit("file-shared", { fileUrl });
  }
  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("🎶 MusicSync Server Running!"));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

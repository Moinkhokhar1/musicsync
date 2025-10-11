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

  socket.on("join-room", ({ roomId, userId, role }) => {
    socket.join(roomId);
    console.log(`🟢 ${userId} joined ${roomId} as ${role}`);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        hostSocketId: role === "host" ? socket.id : null,
        state: {
          isPlaying: false,
          playbackTime: 0,
          playbackRate: 1,
          updatedAt: Date.now(),
        },
      });
    } else {
      const r = rooms.get(roomId);
      if (role === "host") r.hostSocketId = socket.id;
    }

    const state = rooms.get(roomId).state;
    socket.emit("resync", {
      playbackTime: state.playbackTime,
      serverTime: Date.now(),
      isPlaying: state.isPlaying,
    });

    // Broadcast to everyone that someone joined
    io.to(roomId).emit("room-joined", { roomId, userId });
  });

  socket.on("host-play", ({ roomId, playbackTime }) => {
    console.log(`▶️ Host played in ${roomId}`);
    const r = rooms.get(roomId);
    if (!r) return;
    r.state = { ...r.state, isPlaying: true, playbackTime };
    io.to(roomId).emit("sync-play", { playbackTime });
  });

  socket.on("host-pause", ({ roomId, playbackTime }) => {
    console.log(`⏸️ Host paused in ${roomId}`);
    const r = rooms.get(roomId);
    if (!r) return;
    r.state = { ...r.state, isPlaying: false, playbackTime };
    io.to(roomId).emit("sync-pause", { playbackTime });
  });

  socket.on("host-seek", ({ roomId, playbackTime }) => {
    console.log(`⏩ Host seeked in ${roomId}`);
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

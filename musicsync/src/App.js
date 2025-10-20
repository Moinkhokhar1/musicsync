import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SERVER = "https://musicsync-5.onrender.com";

function App() {
  const audioRef = useRef();
  const socketRef = useRef();
  const [roomId, setRoomId] = useState("");
  const [role, setRole] = useState("guest");
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState("join");
  const [fileUrl, setFileUrl] = useState("");

useEffect(() => {
    socketRef.current = io(SERVER, {
      autoConnect: false,
      transports: ["websocket"], 
    });
  
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("room-created", ({ roomId }) => {
      setMessage(`✅ Room ${roomId} created successfully!`);
    });

    s.on("room-error", ({ message }) => {
      setMessage(`❌ ${message}`);
    });

    s.on("resync", ({ playbackTime, isPlaying, fileUrl }) => {
      if (fileUrl) {
        setFileUrl(SERVER + fileUrl);
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = playbackTime;
      isPlaying ? audio.play().catch(() => {}) : audio.pause();
    });

    s.on("file-shared", ({ fileUrl }) => {
      const fullUrl = SERVER + fileUrl;
      setFileUrl(fullUrl);
      const audio = audioRef.current;
      audio.src = fullUrl;
      audio.load();
      setMessage("🎵 New track loaded!");
    });

    s.on("sync-play", ({ playbackTime }) => {
      const audio = audioRef.current;
      audio.currentTime = playbackTime;
      audio.play().catch(() => {});
    });

    s.on("sync-pause", ({ playbackTime }) => {
      const audio = audioRef.current;
      audio.currentTime = playbackTime;
      audio.pause();
    });

    s.on("sync-seek", ({ playbackTime }) => {
      const audio = audioRef.current;
      audio.currentTime = playbackTime;
    });

    return () => s.disconnect();
  }, []);

  const connectSocket = () => {
    const s = socketRef.current;
    if (!s.connected) s.connect();
  };

  const handleCreateRoom = () => {
    connectSocket();
    const userId = "host" + Math.floor(Math.random() * 1000);
    socketRef.current.emit("create-room", { roomId, userId });
    setRole("host");
  };

  const handleJoinRoom = () => {
    connectSocket();
    const userId = "guest" + Math.floor(Math.random() * 1000);
    socketRef.current.emit("join-room", { roomId, userId, role });
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("audio", file);

    const uploadRes = await fetch(`${SERVER}/upload`, {
      method: "POST",
      body: formData,
    });
    const { fileUrl } = await uploadRes.json();

    // Notify others in the room
    await fetch(`${SERVER}/notify-file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, fileUrl }),
    });

    setFileUrl(SERVER + fileUrl);
    setMessage("🎵 File uploaded and shared!");
  };

  const hostPlay = async () => {
    const audio = audioRef.current;
    await audio.play();
    socketRef.current.emit("host-play", {
      roomId,
      playbackTime: audio.currentTime,
    });
  };

  const hostPause = () => {
    const audio = audioRef.current;
    audio.pause();
    socketRef.current.emit("host-pause", {
      roomId,
      playbackTime: audio.currentTime,
    });
  };

  const hostSeek = (t) => {
    const audio = audioRef.current;
    audio.currentTime = t;
    socketRef.current.emit("host-seek", { roomId, playbackTime: t });
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "auto", textAlign: "center" }}>
      <h2>🎶 MusicSync App</h2>

      <div>
        <label>
          <input
            type="radio"
            value="create"
            checked={mode === "create"}
            onChange={() => setMode("create")}
          />
          Create Room
        </label>

        <label style={{ marginLeft: 10 }}>
          <input
            type="radio"
            value="join"
            checked={mode === "join"}
            onChange={() => setMode("join")}
          />
          Join Room
        </label>
      </div>

      <input
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        placeholder="Enter Room ID"
        style={{ marginTop: 10, padding: 6, width: "70%" }}
      />

      <div style={{ marginTop: 10 }}>
        {mode === "create" ? (
          <button onClick={handleCreateRoom}>Create Room</button>
        ) : (
          <button onClick={handleJoinRoom}>Join Room</button>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        {connected ? "✅ Connected to Server" : "❌ Not Connected"}
      </div>

      {message && <p style={{ color: "green", marginTop: 5 }}>{message}</p>}

      {role === "host" && (
        <div style={{ marginTop: 20 }}>
          <input type="file" accept="audio/*" onChange={handleUpload} />
        </div>
      )}

      <audio
        ref={audioRef}
        src={fileUrl}
        controls
        style={{ width: "100%", marginTop: 20 }}
      />

      {role === "host" && (
        <div style={{ marginTop: 10 }}>
          <button onClick={hostPlay}>Play</button>
          <button onClick={hostPause}>Pause</button>
          <button onClick={() => hostSeek(30)}>Seek 30s</button>
          <button onClick={() => hostSeek(0)}>Restart</button>
        </div>
      )}
    </div>
  );
}

export default App;

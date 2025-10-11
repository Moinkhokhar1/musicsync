import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const SERVER = "http://localhost:4000";
const AUDIO_URL =
  "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

  function App() {
  const audioRef = useRef();
  const socketRef = useRef();
  const [roomId, setRoomId] = useState("room1");
  const [role, setRole] = useState("guest");
  const [connected, setConnected] = useState(false);
  
    useEffect(() => {
    socketRef.current = io(SERVER, { autoConnect: false });
    const s = socketRef.current;

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    s.on("resync", ({ playbackTime, isPlaying }) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (Math.abs(audio.currentTime - playbackTime) > 0.3) {
        audio.currentTime = playbackTime;
      }
      if (isPlaying) audio.play().catch(() => {});
      else audio.pause();
    });

        s.on("sync-play", ({ playbackTime }) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = playbackTime;
      audio.play().catch(() => {});
    });

    s.on("sync-pause", ({ playbackTime }) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = playbackTime;
      audio.pause();
    });

    s.on("sync-seek", ({ playbackTime }) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = playbackTime;
    });

    return () => s.disconnect();
  }, []);

  // 🧠 Join Room
const joinRoom = () => {
  const s = socketRef.current;

  if (!s) {
    console.log("Socket not initialized yet");
    return;
  }

  if (!roomId || !role) {
    console.log("roomId or role missing");
    return;
  }

  if (!s.connected) s.connect(); // connect only if not already

  const userId = "user" + Math.floor(Math.random() * 1000);
  console.log("Joining room", { roomId, userId, role });

  s.emit("join-room", { roomId, userId, role });
};



  // 🎵 Host Controls
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

  // 🔁 Heartbeat (sync updates every 3s)
  useEffect(() => {
    if (role !== "host") return;
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (audio && socketRef.current.connected) {
        socketRef.current.emit("heartbeat", {
          roomId,
          playbackTime: audio.currentTime,
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [role, roomId]);

   return (
    <div style={{ padding: 20 }}>
      <h2>🎶 MusicSync App</h2>
          <div>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Room ID"
        />

    <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="guest">Guest</option>
          <option value="host">Host</option>
        </select>

        <button onClick={joinRoom} onTouchStart={joinRoom}>Join</button>


        <span style={{ marginLeft: 10 }}>
          {connected ? "✅ Connected" : "❌ Disconnected"}
        </span>
      </div>

    <audio
        ref={audioRef}
        src={AUDIO_URL}
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
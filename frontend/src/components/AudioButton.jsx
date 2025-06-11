// src/components/AudioButton.jsx
import { FaVolumeUp } from "react-icons/fa";
import { useState } from "react";

const AudioButton = ({ text }) => {
  const [playing, setPlaying] = useState(false);

  const playAudio = async () => {
    if (playing) return;                    // prevent double-click spam
    setPlaying(true);
    try {
      const res  = await fetch("https://ivf-backend-server.onrender.com/tts", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ text })
      });
      if (!res.ok) throw new Error("TTS server error");

      const blob = await res.blob();        // waits for full MP3
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      audio.onended = () => setPlaying(false);
    } catch (e) {
      console.error("TTS play error:", e);
      setPlaying(false);
    }
  };

  return (
    <button
      className="audio-btn"
      onClick={playAudio}
      disabled={playing}
      title="Play audio"
    >
      <FaVolumeUp size={14} />
    </button>
  );
};

export default AudioButton;



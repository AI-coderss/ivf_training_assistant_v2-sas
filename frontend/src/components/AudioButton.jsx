import React from "react";
import { FaVolumeUp } from "react-icons/fa";

const AudioButton = ({ text }) => {
  const handlePlay = async () => {
    try {
      const res = await fetch("https://ivf-backend-server.onrender.com/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
      } else {
        throw new Error("No audio returned");
      }
    } catch (err) {
      console.error("TTS Error:", err);
    }
  };

  return (
    <button onClick={handlePlay} className="audio-button">
      <FaVolumeUp size={16} />
    </button>
  );
};

export default AudioButton;


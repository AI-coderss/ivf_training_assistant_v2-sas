import React, { useState } from "react";
import { FaVolumeUp } from "react-icons/fa";


const AudioButton = ({ text }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async () => {
    try {
      setIsPlaying(true);

      const response = await fetch("https://ivf-backend-server.onrender.com/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error("Failed to fetch audio");

      const data = await response.json();
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
      audio.play();

      audio.onended = () => setIsPlaying(false);
    } catch (error) {
      console.error("TTS Error:", error);
      setIsPlaying(false);
    }
  };

  return (
    <button
      className="audio-button"
      onClick={handlePlay}
      disabled={isPlaying}
      title="Play AI response"
    >
      <FaVolumeUp />
    </button>
  );
};

export default AudioButton;


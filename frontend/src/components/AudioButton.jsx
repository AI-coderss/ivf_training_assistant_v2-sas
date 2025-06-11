import { useState } from "react";
import { FaVolumeUp } from "react-icons/fa";

const AudioButton = ({ text }) => {
  const [busy, setBusy] = useState(false);

  const playAudio = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const res   = await fetch("https://ivf-backend-server.onrender.com/tts", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ text })
      });

      if (!res.ok || !res.body) throw new Error("TTS fetch failed");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let base64Acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        base64Acc += decoder.decode(value, { stream: true });

        // Stop if backend signals EOF
        if (base64Acc.includes("[[END_OF_AUDIO]]")) {
          base64Acc = base64Acc.replace("[[END_OF_AUDIO]]", "");
          break;
        }
      }

      // Build and play audio
      const audioUrl = `data:audio/wav;base64,${base64Acc}`;
      const audio    = new Audio(audioUrl);
      audio.play();
      audio.onended = () => setBusy(false);

    } catch (err) {
      console.error("TTS stream error:", err);
      setBusy(false);
    }
  };

  return (
    <button
      className="audio-btn"
      onClick={playAudio}
      disabled={busy}
      title="Play audio"
    >
      <FaVolumeUp size={14}/>
    </button>
  );
};

export default AudioButton;



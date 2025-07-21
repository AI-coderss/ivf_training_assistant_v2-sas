import React, { useEffect, useRef, useState } from "react";
import { FaMicrophoneAlt } from "react-icons/fa";
import { useRealtimeVoiceWithStop } from "../../hooks/useRealtimeVoice";
import AudioWave from "../AudioWave";
import { toast } from "react-toastify";
import "../../styles/content/VoiceAssistant.css";

export default function VoiceAssistant({ isVisible, onClose, context }) {
  const audioRef = useRef(null);

  const {
    transcript,
    toggleMic,
    ready,
    endSession,
    responseStream,
    error,
    micActive,
  } = useRealtimeVoiceWithStop({ context, audioRef });

  const [loadingWave, setLoadingWave] = useState(true);

  useEffect(() => {
    if (responseStream) setLoadingWave(false);
  }, [responseStream]);

  useEffect(() => {
    if (error) {
      let message = error;
      if (error.toLowerCase().includes("connection")) {
        message = "Lost connection to the AI assistant. Please try again.";
      } else if (error.toLowerCase().includes("microphone")) {
        message = "Microphone access failed. Please check permissions.";
      } else if (error.toLowerCase().includes("sdp")) {
        message = "Something went wrong initializing audio. Try refreshing.";
      } else if (error.toLowerCase().includes("failed to fetch")) {
        message = "Couldn’t reach the assistant service. Check internet.";
      }
      toast.error(message);
    }
  }, [error]);

  if (!isVisible) return null;

  const handleClose = () => {
    console.log("Closing assistant and ending session");
    endSession();
    onClose();
  };

  const handleMicPress = () => {
    if (ready) toggleMic(true);
  };

  const handleMicRelease = () => {
    if (ready) toggleMic(false);
  };

  return (
    <div className="voice-assistant">
      {loadingWave && (
        <div className="assistant-loader-overlay">
          <div className="assistant-loader">
            <p>Loading assistant...</p>
            <div className="spinner" />
          </div>
        </div>
      )}

      <img src="/av.gif" alt="AI Orb" className="assistant-orb" />
      <div className="assistant-content">
        {error && <p className="error">{error}</p>}
        <p>{transcript}</p>
        {responseStream && (
          <div className="waveform-container">
            <AudioWave stream={responseStream} />
          </div>
        )}
        <audio ref={audioRef} autoPlay style={{ display: "none" }} />
      </div>

      <div className="assistant-footer">
        <button
          className={`mic-icon-btn ${micActive ? "mic-active" : ""}`}
          onMouseDown={handleMicPress}
          onMouseUp={handleMicRelease}
          onTouchStart={handleMicPress}
          onTouchEnd={handleMicRelease}
          disabled={!ready}
          title={ready ? "Hold to speak" : "Connecting…"}
        >
          <FaMicrophoneAlt size={24} />
        </button>
        <button className="close-btn" onClick={handleClose}>
          ❌
        </button>
      </div>
    </div>
  );
}
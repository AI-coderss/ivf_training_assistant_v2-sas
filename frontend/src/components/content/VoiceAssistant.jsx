import React from "react";
import "../../styles/content/VoiceAssistant.css";
import { FaMicrophoneAlt } from "react-icons/fa";

const VoiceAssistant = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="voice-assistant">
      {/* Orb Element */}
      <img src="/av.gif" alt="AI Orb" className="assistant-orb" />

      <div className="assistant-content">
      </div>

      <div className="assistant-footer">
        <button className="mic-icon-btn" title="Start speaking">
          <FaMicrophoneAlt size={24} />
        </button>
        <button className="close-btn" onClick={onClose}>❌</button>
      </div>
    </div>
  );
};

export default VoiceAssistant;




import React, { useEffect, useRef, useState } from "react";
import { FaMicrophoneAlt } from "react-icons/fa";
import { useRealtimeVoiceWithStop } from "../../hooks/useRealtimeVoice";
import AudioWave from "../AudioWave";
import { toast } from "react-toastify";
import "../../styles/content/VoiceAssistant.css";
import BaseOrb from "../BaseOrb";

// ✅ Same store BaseOrb reads from
import useAudioForVisualizerStore from "../../store/useAudioForVisualizerStore";

// ✅ Prefer your helper if present (streamOrEl, setAudioScale)
import { startVolumeMonitoring as _startVolumeMonitoring } from "../audioLevelAnalyzer";

export default function VoiceAssistant({ isVisible, onClose, context }) {
  const audioRef = useRef(null);

  const {
    transcript,
    toggleMic,
    ready,
    endSession,
    responseStream,     // <- AI-generated audio (MediaStream) if your hook exposes it
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

  // 🔊 Monitor the AI OUTPUT (responseStream / <audio>), update store → BaseOrb reacts
  useEffect(() => {
    if (!isVisible) return;
    const el = audioRef.current;
    const { setAudioScale } = useAudioForVisualizerStore.getState();

    let stop = null;
    let rafId = null;
    let ctx = null;
    let analyser = null;
    let source = null;

    // Fallback analyzer for HTMLMediaElement/MediaStream
    const startFallbackAnalyser = (target) => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();

        if (target instanceof MediaStream) {
          source = ctx.createMediaStreamSource(target);
        } else if (target instanceof HTMLMediaElement) {
          // Tap the element output; do NOT route to destination (avoid double sound)
          source = ctx.createMediaElementSource(target);
        } else if (el?.srcObject instanceof MediaStream) {
          source = ctx.createMediaStreamSource(el.srcObject);
        }

        if (!source) return () => {};

        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        // Only connect to analyser (the element itself still plays to speakers)
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((s, v) => s + v, 0) / data.length;
          // Normalize & gently boost → BaseOrb will further enhance via enhanceAudioScale()
          const normalized = Math.max(0, Math.min(1, avg / 64)); // ~0..1
          setAudioScale(normalized);
          rafId = requestAnimationFrame(tick);
        };
        tick();

        return () => {
          cancelAnimationFrame(rafId);
          try { source.disconnect(); } catch {}
          try { analyser.disconnect(); } catch {}
          try { ctx.close(); } catch {}
          setAudioScale(0);
        };
      } catch {
        setAudioScale(0);
        return () => {};
      }
    };

    // Prefer your helper (signature like startVolumeMonitoring(target, setAudioScale))
    const tryHelper = (target) => {
      if (typeof _startVolumeMonitoring === "function" && target) {
        try {
          const maybeStop = _startVolumeMonitoring(target, setAudioScale);
          if (typeof maybeStop === "function") {
            return maybeStop;
          }
        } catch {
          // fall through to fallback
        }
      }
      return null;
    };

    // Choose best available target: MediaStream → <audio>.srcObject → <audio> element
    const target =
      (responseStream instanceof MediaStream && responseStream) ||
      (el?.srcObject instanceof MediaStream && el.srcObject) ||
      el ||
      null;

    stop = tryHelper(target) || startFallbackAnalyser(target);

    return () => {
      if (typeof stop === "function") stop();
    };
  }, [responseStream, isVisible]);

  if (!isVisible) return null;

  const handleClose = () => {
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

      {/* Orb in the exact GIF spot; BaseOrb pulls audioScale from the store */}
      <div className="assistant-orb">
        <BaseOrb />
      </div>

      <div className="assistant-content">
        {error && <p className="error">{error}</p>}
        <p>{transcript}</p>
        {responseStream && (
          <div className="waveform-container">
            <AudioWave stream={responseStream} />
          </div>
        )}
        {/* Hidden element that plays the AI audio; also used for visualization tap */}
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          style={{ display: "none" }}
          onError={(e) => console.error("Audio playback error:", e?.target?.error)}
        />
      </div>

      <div className="assistant-footer">
        <button
          className={`mic-btn ${micActive ? "mic-active" : ""}`}
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


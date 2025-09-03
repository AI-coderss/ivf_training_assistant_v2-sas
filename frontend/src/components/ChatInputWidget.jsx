/* eslint-disable react-hooks/exhaustive-deps */
// src/components/ChatInputWidget.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import "../styles/ChatInputWidget.css";

const BACKEND_TRANSCRIBE_URL = "https://ivf-backend-server.onrender.com/transcribe";

const ChatInputWidget = ({ onSendMessage }) => {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [err, setErr] = useState(null);

  const textAreaRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // --------- UI helpers ---------
  const adjustTextAreaHeight = (reset = false) => {
    if (!textAreaRef.current) return;
    textAreaRef.current.style.height = "auto";
    if (!reset) {
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextAreaHeight();
  }, []);

  // --------- Recording ---------
  const startRecording = useCallback(async () => {
    setErr(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
        video: false,
      });
      streamRef.current = stream;

      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          chunksRef.current = [];
          await transcribeBlob(blob);
        } catch (e) {
          setErr("Failed to process recording.");
        } finally {
          // stop tracks
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
          }
          setIsRecording(false);
        }
      };

      mr.start(250); // collect in small chunks
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setErr("Microphone permission denied or unavailable.");
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // --------- Upload to backend → Whisper ---------
  const transcribeBlob = useCallback(async (blob) => {
    setIsLoading(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      // Optional: lock language or add prompt
      // form.append("language", "en");
      // form.append("prompt", "Medical context: ...");
      // form.append("response_format", "text");

      const res = await fetch(BACKEND_TRANSCRIBE_URL, { method: "POST", body: form });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const newText = (data?.text || "").trim();

      setInputText((prev) => {
        const merged = prev ? `${prev}${prev.endsWith(" ") ? "" : " "}${newText}` : newText;
        requestAnimationFrame(adjustTextAreaHeight);
        return merged;
      });
    } catch (e) {
      console.error(e);
      setErr("Transcription failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --------- Send behavior (unchanged) ---------
  const handleSendMessage = () => {
    if (inputText.trim().length > 0) {
      onSendMessage?.({ text: inputText });
      setInputText("");
      adjustTextAreaHeight(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim().length > 0) handleSendMessage();
    }
  };

  const handleIconClick = () => {
    if (inputText.trim().length > 0) {
      handleSendMessage();
    } else {
      if (isRecording) stopRecording();
      else startRecording();
    }
  };

  return (
    <div className="chat-container">
      {/* Loader overlay */}
      {isLoading && (
        <div className="loader-overlay">
          <div className="loader-card">
            <div className="spinner" />
            <div className="loader-text">Transcribing with Whisper…</div>
          </div>
        </div>
      )}

      <textarea
        ref={textAreaRef}
        className="chat-input"
        placeholder={isRecording ? "Recording… press stop when done" : "Chat in text or start speaking..."}
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value);
          adjustTextAreaHeight();
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        style={{ resize: "none", overflow: "hidden" }}
        disabled={isLoading}
      />

      <button className="icon-btn" onClick={handleIconClick} disabled={isLoading}>
        {inputText.trim().length > 0 ? (
          <SendIcon />
        ) : isRecording ? (
          <StopIcon />
        ) : (
          <MicIcon />
        )}
      </button>

      {err && <div className="chat-error">{err}</div>}
    </div>
  );
};

export default ChatInputWidget;

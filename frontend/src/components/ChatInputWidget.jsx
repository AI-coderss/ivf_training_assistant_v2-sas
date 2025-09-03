// src/components/ChatInputWidget.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import "../styles/ChatInputWidget.css";

/**
 * Realtime transcription via your backend WS bridge
 * Backend base: https://ivf-backend-server.onrender.com
 * WS endpoint : wss://ivf-backend-server.onrender.com/ws/transcribe
 *
 * Notes:
 * - Use wss:// for secure WebSocket when your backend is https. :contentReference[oaicite:0]{index=0}
 */
const ChatInputWidget = ({ onSendMessage }) => {
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const textAreaRef = useRef(null);

  // WS + audio refs
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  // 🔗 Fixed backend WS URL (no dynamic location usage)
  const BACKEND_WS_URL = "wss://ivf-backend-server.onrender.com/ws/transcribe";

  const adjustTextAreaHeight = (reset = false) => {
    if (!textAreaRef.current) return;
    textAreaRef.current.style.height = "auto";
    if (!reset) textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
  };

  useEffect(() => {
    adjustTextAreaHeight();
  }, []);

  const floatTo16BitPCM = (float32Array) => {
    const out = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const base64EncodePCM16 = (int16) => {
    let binary = "";
    const bytes = new Uint8Array(int16.buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  // Handle events from your backend → OpenAI Realtime
  const handleRealtimeEvent = useCallback((evt) => {
    let data;
    try {
      data = JSON.parse(evt.data);
    } catch {
      return;
    }
    const t = data?.type || "";

    if (t === "input_audio_buffer.speech_started") {
      setIsTranscribing(true);
      return;
    }
    if (t === "input_audio_buffer.speech_stopped") {
      return;
    }

    const maybeText =
      data?.text || data?.transcript || data?.output_text || data?.item?.content || null;

    if (t.includes("transcription") && maybeText) {
      setInputText((prev) => {
        const sep = prev && !prev.endsWith(" ") ? " " : "";
        const merged = `${prev}${sep}${maybeText}`.trim();
        requestAnimationFrame(adjustTextAreaHeight);
        return merged;
      });
      setIsTranscribing(false);
      return;
    }

    if (t.endsWith(".delta") && (data?.delta || data?.text)) {
      const delta = data?.delta || data?.text;
      setInputText((prev) => {
        const sep = prev && !prev.endsWith(" ") ? " " : "";
        const merged = `${prev}${sep}${delta}`.trim();
        requestAnimationFrame(adjustTextAreaHeight);
        return merged;
      });
    }
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      // 1) Connect to your fixed WS URL (Render requires wss + no custom port). :contentReference[oaicite:1]{index=1}
      const ws = new WebSocket(BACKEND_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {};
      ws.onmessage = handleRealtimeEvent;
      ws.onerror = () => setErrorMsg("Transcription socket error.");
      ws.onclose = () => {
        wsRef.current = null;
        setIsTranscribing(false);
      };

      // 2) getUserMedia and stream PCM16 → base64 → input_audio_buffer.append
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
        video: false,
      });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = floatTo16BitPCM(input);
        const b64 = base64EncodePCM16(pcm16);
        wsRef.current.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
      };

      setIsRecording(true);
      setIsTranscribing(true);
    } catch (err) {
      console.error(err);
      setErrorMsg("Microphone or socket failed. Check permissions and server.");
      try {
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
      } catch {}
      wsRef.current = null;
      setIsRecording(false);
      setIsTranscribing(false);
    }
  }, [handleRealtimeEvent]);

  const stopRecording = useCallback(() => {
    try {
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    } catch {}
    processorRef.current = null;
    sourceRef.current = null;
    audioCtxRef.current = null;
    streamRef.current = null;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;

    setIsRecording(false);
    setIsTranscribing(false);
  }, []);

  // input + send (unchanged)
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    adjustTextAreaHeight();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim().length > 0) handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (inputText.trim().length > 0) {
      onSendMessage({ text: inputText });
      setInputText("");
      adjustTextAreaHeight(true);
    }
    if (isRecording) stopRecording();
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
      <textarea
        ref={textAreaRef}
        className="chat-input"
        placeholder={isTranscribing ? "Transcribing…" : "Chat in text or start speaking..."}
        value={inputText}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        rows={1}
        style={{ resize: "none", overflow: "hidden" }}
        disabled={isTranscribing}
      />
      <button className="icon-btn" onClick={handleIconClick} disabled={isTranscribing}>
        {inputText.trim().length > 0 ? <SendIcon /> : isRecording ? <StopIcon /> : <MicIcon />}
      </button>
      {errorMsg && <div className="chat-error">{errorMsg}</div>}
    </div>
  );
};

export default ChatInputWidget;

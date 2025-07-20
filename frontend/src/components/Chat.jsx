import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";
import BaseOrb from "./BaseOrb";
import AudioVisualizer from "./AudioVisualizer";
import { FaMicrophoneAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import useAudioStore from "../store/audioStore";
import "../styles/chat.css";

const Chat = () => {
  const [chats, setChats] = useState([
    {
      msg: "Hi there! How can I assist you today with your IVF Training?",
      who: "bot",
    },
  ]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [micStream, setMicStream] = useState(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [peerConnection, setPeerConnection] = useState(null);
  const [dataChannel, setDataChannel] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("idle");

  const { audioUrl, setAudioUrl, stopAudio } = useAudioStore();
  const scrollAnchorRef = useRef(null);
  const [sessionId] = useState(() => {
    const id = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", id);
    return id;
  });

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  useEffect(() => {
    fetch("https://ivf-backend-server.onrender.com/suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestedQuestions(data.suggested_questions || []))
      .catch((err) => console.error("❌ Failed to fetch suggestions:", err));
  }, []);

  useEffect(() => {
    return () => {
      micStream?.getTracks().forEach((track) => track.stop());
      peerConnection?.close();
      dataChannel?.close();
      setMicStream(null);
      setPeerConnection(null);
      setDataChannel(null);
      setConnectionStatus("idle");
      setIsMicActive(false);
      stopAudio();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWebRTC = async () => {
    if (peerConnection || connectionStatus === "connecting") return;
    setConnectionStatus("connecting");
    setIsMicActive(false);

    const pc = new RTCPeerConnection();
    setPeerConnection(pc);

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setAudioUrl(remoteStream);
        console.log("🎧 Received remote audio stream");
      }
    };

    const channel = pc.createDataChannel("response");
    setDataChannel(channel);

    channel.onopen = () => {
      setConnectionStatus("connected");
      setIsMicActive(true);
      micStream?.getAudioTracks().forEach((track) => (track.enabled = true));
    };

    channel.onclose = () => {
      setConnectionStatus("idle");
      setIsMicActive(false);
    };

    channel.onerror = (err) => {
      console.error("⚠️ DataChannel error:", err);
      setConnectionStatus("error");
      setIsMicActive(false);
    };

    channel.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "output_audio_buffer.stopped":
          stopAudio();
          break;
        default:
          console.log("📥 Unhandled message:", msg.type);
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getAudioTracks().forEach((track) => (track.enabled = false));
      setMicStream(stream);

      stream.getAudioTracks().forEach((track) =>
        pc.addTransceiver(track, { direction: "sendrecv" })
      );

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(
        "https://voiceassistant-mode-webrtc-server.onrender.com/api/rtc-connect",
        {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        }
      );

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const answer = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (error) {
      console.error("WebRTC connection failed:", error);
      setConnectionStatus("error");
    }
  };

  const toggleMic = () => {
    if (connectionStatus === "idle" || connectionStatus === "error") {
      console.log("🎤 Attempting to connect mic...");
      startWebRTC();
      return;
    }

    if (connectionStatus === "connected" && micStream) {
      const newMicState = !isMicActive;
      setIsMicActive(newMicState);
      micStream.getAudioTracks().forEach((track) => (track.enabled = newMicState));
    } else {
      console.warn("🎤 Mic toggle attempted but stream is not ready.");
    }
  };

  const handleEnterVoiceMode = () => {
    setIsVoiceMode(true);
  };

  const handleNewMessage = async ({ text }) => {
    if (!text) return;

    setSuggestedQuestions((prev) =>
      prev.filter((q) => q.trim() !== text.trim())
    );

    setChats((prev) => [...prev, { msg: text, who: "me" }]);

    const res = await fetch("https://ivf-backend-server.onrender.com/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, session_id: sessionId }),
    });

    if (!res.ok || !res.body) {
      setChats((prev) => [
        ...prev,
        { msg: "Something went wrong.", who: "bot" },
      ]);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let message = "";
    let isFirstChunk = true;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });

      if (isFirstChunk) {
        setChats((prev) => [...prev, { msg: "", who: "bot" }]);
        isFirstChunk = false;
      }

      message += chunk;
      // eslint-disable-next-line no-loop-func
      setChats((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].msg = message;
        return updated;
      });
    }
  };

  const renderMessage = (message) => {
    const regex = /```mermaid([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(message))) {
      const before = message.slice(lastIndex, match.index);
      const code = match[1];
      if (before) parts.push({ type: "text", content: before });
      parts.push({ type: "mermaid", content: code });
      lastIndex = regex.lastIndex;
    }
    const after = message.slice(lastIndex);
    if (after) parts.push({ type: "text", content: after });

    return parts.map((part, idx) =>
      part.type === "mermaid" ? (
        <CollapsibleDiagram chart={part.content.trim()} key={idx} />
      ) : (
        <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
          {part.content}
        </ReactMarkdown>
      )
    );
  };

  if (isVoiceMode) {
    return (
      <div className="voice-assistant-wrapper">
        <div className="top-center-orb">
          <BaseOrb />
          {audioUrl && <AudioVisualizer />}
        </div>

        <div className="mic-controls">
          {connectionStatus === "connecting" && (
            <div className="connection-status connecting">🔄 Connecting...</div>
          )}
          <button
            className={`mic-icon-btn ${isMicActive ? "active" : ""}`}
            onClick={toggleMic}
            disabled={connectionStatus === "connecting"}
          >
            <FaMicrophoneAlt />
          </button>
          <button className="closed-btn" onClick={() => setIsVoiceMode(false)}>
            ✖
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      <div className="suggestion-column">
        <SuggestedQuestionsAccordion
          questions={suggestedQuestions}
          onQuestionClick={(q) => {
            handleNewMessage({ text: q });
            setSuggestedQuestions((prev) => prev.filter((item) => item !== q));
          }}
        />
      </div>

      <div className="chat-content">
        {chats.map((chat, index) => (
          <div key={index} className={`chat-message ${chat.who}`}>
            {chat.who === "bot" && (
              <figure className="avatar">
                <img src="/av.gif" alt="avatar" />
              </figure>
            )}
            <div className="message-text">{renderMessage(chat.msg)}</div>
          </div>
        ))}
        <div ref={scrollAnchorRef} />
      </div>

      <div className="chat-footer">
        <SuggestedQuestionsAccordion
          questions={suggestedQuestions}
          onQuestionClick={(q) => {
            handleNewMessage({ text: q });
            setSuggestedQuestions((prev) => prev.filter((item) => item !== q));
          }}
        />
        <ChatInputWidget onSendMessage={handleNewMessage} />
      </div>

      <button className="voice-toggle-button" onClick={handleEnterVoiceMode}>
        🎙️
      </button>
    </div>
  );
};

export default Chat;

const CollapsibleDiagram = ({ chart }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="collapsible-diagram">
      <div
        className="collapsible-header"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="toggle-icon">{isOpen ? "–" : "+"}</span> View Diagram
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="collapsible-body"
          >
            <Mermaid chart={chart} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SuggestedQuestionsAccordion = ({ questions, onQuestionClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!questions.length) return null;

  return (
    <>
      {/* Desktop */}
      <div className="suggestion-column-desktop">
        <h4 className="suggestion-title">Suggested Questions</h4>
        <div className="suggestion-list">
          {questions.map((q, idx) => (
            <button
              key={idx}
              className="suggestion-item"
              onClick={() => onQuestionClick(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile */}
      <div className="mobile-suggestions">
        <button className="accordion-toggle" onClick={() => setIsOpen(!isOpen)}>
          <span className="accordion-toggle-icon">{isOpen ? "−" : "+"}</span>
          Suggested Questions
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="accordion-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="mobile-suggestion-list">
                {questions.map((q, idx) => (
                  <button
                    key={idx}
                    className="mobile-suggestion-item"
                    onClick={() => {
                      onQuestionClick(q);
                      setIsOpen(false);
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};


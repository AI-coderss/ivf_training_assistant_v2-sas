import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";
import BaseOrb from "./BaseOrb";
import { FaMicrophoneAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
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

  const [sessionId] = useState(() => {
    const id = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", id);
    return id;
  });

  const chatContentRef = useRef(null);
  const scrollAnchorRef = useRef(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  useEffect(() => {
    fetch("https://ivf-backend-server.onrender.com/suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestedQuestions(data.suggested_questions || []))
      .catch((err) => console.error("Failed to fetch suggestions:", err));
  }, []);

  // WebRTC setup
  useEffect(() => {
    if (!isVoiceMode) return;

    const startWebRTC = async () => {
      const pc = new RTCPeerConnection();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getAudioTracks().forEach((track) =>
        pc.addTransceiver(track, { direction: "sendrecv" })
      );
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch("https://patient-assistant-avatar-server-webrtc.onrender.com/api/rtc-connect", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      const answer = await res.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      setPeerConnection(pc);
      setMicStream(stream);
    };

    startWebRTC();

    return () => {
      micStream?.getTracks().forEach((track) => track.stop());
      peerConnection?.close();
      setMicStream(null);
      setPeerConnection(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceMode]);

  const toggleMic = () => {
    if (!micStream) return;
    const enabled = !isMicActive;
    micStream.getAudioTracks().forEach((track) => (track.enabled = enabled));
    setIsMicActive(enabled);
  };

  const handleNewMessage = async (data) => {
    if (!data.text) return;

    setChats((prev) => [...prev, { msg: data.text, who: "me" }]);

    const diagramKeywords = ["diagram", "flowchart", "process map", "chart"];
    const textLower = data.text.toLowerCase();
    const wantsDiagram = diagramKeywords.some((kw) => textLower.includes(kw));

    const streamUrl = "https://ivf-backend-server.onrender.com/stream";
    const diagramUrl = "https://ivf-backend-server.onrender.com/diagram";

    const streamPayload = { message: data.text, session_id: sessionId };

    const diagramPromise = wantsDiagram
      ? fetch(diagramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: data.text, session_id: sessionId }),
        }).then((res) => res.json())
      : Promise.resolve({ syntax: "" });

    try {
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(streamPayload),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");

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
          if (updated.length > 0 && updated[updated.length - 1].who === "bot") {
            updated[updated.length - 1].msg = message;
          }
          return updated;
        });
      }

      const diagramData = await diagramPromise;
      const diagramSyntax = diagramData.syntax || "";

      if (diagramSyntax.trim()) {
        setChats((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].who === "bot") {
            updated[
              updated.length - 1
            ].msg += `\n\n\`\`\`mermaid\n${diagramSyntax}\n\`\`\``;
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("AI response error:", err);
      setChats((prev) => [
        ...prev,
        {
          msg: "Sorry, something went wrong with the response.",
          who: "bot",
        },
      ]);
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

  // ✅ VOICE MODE LAYOUT
  if (isVoiceMode) {
    return (
      <div className="voice-assistant-wrapper">
      <div className="orb-top">
        <BaseOrb />
      </div>

      <button
        className={`mic-icon-btn ${isMicActive ? "active" : ""}`}
        onClick={toggleMic}
      >
        <FaMicrophoneAlt />
      </button>

      <button className="close-btn" onClick={() => setIsVoiceMode(false)}>
        ❌
      </button>
      </div>
    );
  }

  // 💬 Default Chat Layout
  return (
    <div className="chat-layout">
      <div className="chat-content" ref={chatContentRef}>
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
        <ChatInputWidget onSendMessage={handleNewMessage} />
      </div>

      <div className="suggestion-column">
        <h4 className="suggestion-title">💡 Suggested Questions</h4>
        <div className="suggestion-list">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              className="suggestion-item"
              style={{ "--i": idx }}
              onClick={() => {
                handleNewMessage({ text: q });
                setSuggestedQuestions((prev) =>
                  prev.filter((item) => item !== q)
                );
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <button className="voice-toggle-button" onClick={() => setIsVoiceMode(true)}>
        🎤
      </button>
    </div>
  );
};

export default Chat;

const CollapsibleDiagram = ({ chart }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="collapsible-diagram">
      <div className="collapsible-header" onClick={() => setIsOpen((prev) => !prev)}>
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

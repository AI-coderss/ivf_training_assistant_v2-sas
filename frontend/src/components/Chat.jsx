import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";
import BaseOrb from "./BaseOrb";
import AudioWave from "./AudioWave";
import { FaMicrophoneAlt } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import useAudioForVisualizerStore from "../store/useAudioForVisualizerStore";
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
  // eslint-disable-next-line no-unused-vars
  const { audioUrl, setAudioUrl, clearAudioUrl } = useAudioForVisualizerStore();

  const scrollAnchorRef = useRef(null);
  const audioPlayerRef = useRef(null); // Ref for the audio element
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
      .catch((err) => console.error("Failed to fetch suggestions:", err));
  }, []);

  useEffect(() => {
    if (!isVoiceMode) return;

    const startWebRTC = async () => {
      setConnectionStatus("connecting");

      const pc = new RTCPeerConnection();

      // **FIX #1: More robust ontrack handler**
      pc.ontrack = (event) => {
        console.log("🔊 Received remote audio track", event.track);
        if (audioPlayerRef.current && event.streams && event.streams[0]) {
          audioPlayerRef.current.srcObject = event.streams[0];
          audioPlayerRef.current.muted = false; // Ensure player is unmuted
          audioPlayerRef.current
            .play()
            .catch((error) => console.error("Audio playback failed:", error));
        }
      };

      const channel = pc.createDataChannel("response");

      channel.onopen = () => {
        console.log("✅ DataChannel opened");
        setConnectionStatus("connected");
      };
      channel.onclose = () => {
        console.log("⚠️ DataChannel closed");
        setConnectionStatus("idle");
      };
      channel.onerror = (error) => {
        console.error("❌ DataChannel error:", error);
        setConnectionStatus("error");
      };
      channel.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "response.text.delta") {
          setChats((prev) => {
            const updated = [...prev];
            if (updated[updated.length - 1]?.who === "bot") {
              updated[updated.length - 1].msg += msg.delta;
            } else {
              updated.push({ msg: msg.delta, who: "bot" });
            }
            return updated;
          });
        } else if (msg.type === "output_audio_buffer.stopped") {
          clearAudioUrl();
        }
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream
          .getAudioTracks()
          .forEach((track) =>
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

        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }

        const answer = await res.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answer });

        setMicStream(stream);
        setPeerConnection(pc);
        setDataChannel(channel);
      } catch (error) {
        console.error("WebRTC connection failed:", error);
        setConnectionStatus("error");
      }
    };

    startWebRTC();

    return () => {
      micStream?.getTracks().forEach((track) => track.stop());
      peerConnection?.close();
      dataChannel?.close();
      setMicStream(null);
      setPeerConnection(null);
      setDataChannel(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceMode]);

  // **FIX #2: New handler to unlock audio on user click**
  const handleEnterVoiceMode = () => {
    if (audioPlayerRef.current) {
      console.log("Priming audio element...");
      audioPlayerRef.current.muted = true;
      audioPlayerRef.current.play().catch((e) => {
        // This is expected to fail in some cases, we can ignore the error.
        // The main goal is to signal user intent to the browser.
        console.warn("Audio priming play() call was interrupted.", e.message);
      });
    }
    setIsVoiceMode(true);
  };

  const toggleMic = () => {
    if (!micStream || !dataChannel || dataChannel.readyState !== "open") {
      console.warn("Mic toggle attempted but dataChannel is not open");
      return;
    }

    const enabled = !isMicActive;
    micStream.getAudioTracks().forEach((track) => (track.enabled = enabled));
    setIsMicActive(enabled);

    dataChannel.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          turn_detection: null,
          input_audio_transcription: { model: "whisper-1" },
        },
      })
    );
  };

  const handleNewMessage = async ({ text }) => {
    if (!text) return;
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
        <div className="orb-top">
          <BaseOrb />
          {audioUrl && (
            <AudioWave audioUrl={audioUrl} onEnded={clearAudioUrl} />
          )}
        </div>

        <div className="mic-controls">
          {connectionStatus !== "connected" && (
            <div className={`connection-status ${connectionStatus}`}>
              {connectionStatus === "connecting" ? (
                <>
                  🔄 Connecting
                  <span className="dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </>
              ) : (
                "❌ Failed to connect. Try again."
              )}
            </div>
          )}
          <button
            className={`mic-icon-btn ${isMicActive ? "active" : ""}`}
            onClick={toggleMic}
            disabled={connectionStatus !== "connected"}
          >
            <FaMicrophoneAlt />
          </button>
          <button className="closed-btn" onClick={() => setIsVoiceMode(false)}>
            ❌
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-layout">
      {/* **FIX #3: Add audio player to the DOM (it can be hidden)** */}
      <audio ref={audioPlayerRef} playsInline style={{ display: "none" }} />
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
        <ChatInputWidget onSendMessage={handleNewMessage} />
      </div>

      <div className="suggestion-column">
        <h4 className="suggestion-title">💡 Suggested Questions</h4>
        <div className="suggestion-list">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              className="suggestion-item"
              onClick={() => handleNewMessage({ text: q })}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <button
        className="voice-toggle-button"
        // **FIX #4: Use the new handler on the button**
        onClick={handleEnterVoiceMode}
      >
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

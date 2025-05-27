import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import ChatInputWidget from "../ChatInputWidget";
import "../../styles/Chatbot.css";

const ChatBot = ({ open: forceOpen = false, initialMessage = "" }) => {
  const [open, setOpen] = useState(forceOpen);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatBodyRef = useRef(null);
  const [sessionId] = useState(() => {
    const id = localStorage.getItem("chatbot-session") || crypto.randomUUID();
    localStorage.setItem("chatbot-session", id);
    return id;
  });

  // Auto-open logic
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  // 🧠 Stream initial AI feedback if provided
  useEffect(() => {
    if (initialMessage) {
      setLoading(true);
      const fetchFeedback = async () => {
        try {
          const response = await fetch("https://ivf-backend-server.onrender.com/quiz-feedback-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: initialMessage, session_id: sessionId }),
          });

          if (!response.ok || !response.body) throw new Error("Stream error");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let full = "";
          setMessages((prev) => [...prev, { type: "bot", text: "" }]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            full += decoder.decode(value, { stream: true });

            // eslint-disable-next-line no-loop-func
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { type: "bot", text: full };
              return updated;
            });
          }
        } catch (err) {
          setMessages((prev) => [...prev, { type: "bot", text: "⚠️ Failed to load feedback." }]);
        } finally {
          setLoading(false);
        }
      };
      fetchFeedback();
    } else {
      setMessages([{ type: "bot", text: "Hi! Ask me anything about these AI tools." }]);
    }
  }, [initialMessage, sessionId]);

  const handleSendMessage = async ({ text }) => {
    if (!text?.trim()) return;

    const userMsg = { type: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await fetch(
        "https://ai-platform-dsah-backend-chatbot.onrender.com/stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, session_id: sessionId })
        }
      );

      if (!response.ok || !response.body) throw new Error("Streaming failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botText = "";
      setMessages((prev) => [...prev, { type: "bot", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        botText += decoder.decode(value, { stream: true });

        // eslint-disable-next-line no-loop-func
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { type: "bot", text: botText };
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { type: "bot", text: "⚠️ Error streaming response." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useLayoutEffect(() => {
    if (chatBodyRef.current) {
      requestAnimationFrame(() => {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
      });
    }
  }, [messages, loading]);

  return (
    <>
      {!forceOpen && (
        <button className="chat-toggle" onClick={() => setOpen(!open)}>
          <img src="/icons/chat.svg" alt="Chat" className="chat-icon" />
        </button>
      )}

      {open && window.innerWidth <= 768 && !forceOpen && (
        <button className="chat-close-mobile" onClick={() => setOpen(false)}>
          ✖
        </button>
      )}

      {open && (
        <div className="chat-box">
          <div className="chat-header" style={{ background: "#2563eb", color: "#fff", fontWeight: 600 }}>
            AI Assistant
          </div>

          <div className="chat-body" ref={chatBodyRef}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`chat-msg ${msg.type}`}
                style={{
                  maxWidth: "70%",
                  alignSelf: msg.type === "user" ? "flex-end" : "flex-start",
                  background: msg.type === "user" ? "#2563eb" : "#f1f6fd",
                  color: msg.type === "user" ? "#fff" : "#222",
                  padding: "8px 12px",
                  margin: msg.type === "user" ? "6px" : "0px 15px",
                  borderRadius: "14px",
                  fontSize: "14px",
                  lineHeight: 1.4,
                }}
              >
                {msg.type === "bot" ? (
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-msg bot loader" style={{ alignSelf: "flex-start" }}>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            )}
          </div>

          <ChatInputWidget onSendMessage={handleSendMessage} />
        </div>
      )}
    </>
  );
};

export default ChatBot;


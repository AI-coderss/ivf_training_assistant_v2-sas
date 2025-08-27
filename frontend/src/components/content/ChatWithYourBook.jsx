/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-loop-func */
import React, { useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import ChatInputWidget from "../ChatInputWidget";
import "../../styles/content/ChatWithYourBook.css";

/**
 * Draggable chat widget (header = drag handle).
 * Opens only from the "Chat" tab. No floating icon.
 */
const ChatWithYourBook = ({
  endpoint = "/api/chat-with-book/stream",
  open = false,
  onOpenChange,
}) => {
  const [messages, setMessages] = useState([
    { type: "bot", text: "Ask me anything about the current book." },
  ]);
  const [loading, setLoading] = useState(false);
  const chatBodyRef = useRef(null);

  // Dragging
  const boxRef = useRef(null);
  const dragData = useRef({ startX: 0, startY: 0, baseX: 360, baseY: 140, dragging: false });

  const setPos = (x, y) => {
    const node = boxRef.current;
    if (!node) return;
    node.style.setProperty("--drag-left", `${x}px`);
    node.style.setProperty("--drag-top", `${y}px`);
  };

  useLayoutEffect(() => { setPos(dragData.current.baseX, dragData.current.baseY); }, []);

  const startDrag = (clientX, clientY) => {
    dragData.current.dragging = true;
    dragData.current.startX = clientX - dragData.current.baseX;
    dragData.current.startY = clientY - dragData.current.baseY;
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", endDrag);
  };

  const onDragMove = (e) => {
    if (!dragData.current.dragging) return;
    const x = Math.max(8, e.clientX - dragData.current.startX);
    const y = Math.max(70, e.clientY - dragData.current.startY);
    dragData.current.baseX = x; dragData.current.baseY = y; setPos(x, y);
  };

  const onTouchMove = (e) => {
    if (!dragData.current.dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    const x = Math.max(8, t.clientX - dragData.current.startX);
    const y = Math.max(70, t.clientY - dragData.current.startY);
    dragData.current.baseX = x; dragData.current.baseY = y; setPos(x, y);
  };

  const endDrag = () => {
    dragData.current.dragging = false;
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", endDrag);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", endDrag);
  };

  // Safe auto-scroll
  useLayoutEffect(() => {
    if (!open) return;
    const el = chatBodyRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight; });
    return () => cancelAnimationFrame(id);
  }, [messages, loading, open]);

  // Streaming call
  const [sessionId] = useState(() => {
    const id = localStorage.getItem("book-chat-session") || crypto.randomUUID();
    localStorage.setItem("book-chat-session", id);
    return id;
  });

  const handleSendMessage = async ({ text }) => {
    if (!text?.trim()) return;
    setMessages((prev) => [...prev, { type: "user", text }]);
    setLoading(true);

    let botText = "";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });

      if (!response.ok || !response.body) throw new Error("Streaming failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // placeholder for streaming chunks
      setMessages((prev) => [...prev, { type: "bot", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        botText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { type: "bot", text: botText };
          return copy;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { type: "bot", text: "⚠️ Error streaming response." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={boxRef}
      className="chat-box chat-drag"
      style={{ "--drag-left": "360px", "--drag-top": "140px" }}
    >
      <div
        className="chat-header drag-handle"
        onMouseDown={(e) => { if (!e.target.closest?.(".x-btn")) startDrag(e.clientX, e.clientY); }}
        onTouchStart={(e) => {
          if (e.target.closest?.(".x-btn")) return;
          const t = e.touches[0];
          startDrag(t.clientX, t.clientY);
        }}
      >
        <span>Chat with Book</span>
        <button className="x-btn" onClick={() => onOpenChange?.(false)} aria-label="Close chat" title="Close">
          ✕
        </button>
      </div>

      <div className="chat-body" ref={chatBodyRef}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat-msg ${msg.type}`}
            style={{
              maxWidth: "72%",
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
            {msg.type === "bot" ? <ReactMarkdown>{msg.text}</ReactMarkdown> : msg.text}
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
  );
};

export default ChatWithYourBook;

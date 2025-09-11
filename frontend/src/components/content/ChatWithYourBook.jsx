/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-loop-func */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import ChatInputWidget from "../ChatInputWidget";
import "../../styles/content/ChatWithYourBook.css";
import axios from "axios";
// import useBookStore from "../store/bookStore";
import useBookStore from "../../store/bookStore";

function stripMarkdown(text) {
  return text
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, "$1") // links
    .replace(/#+\s/g, "") // headers
    .replace(/>\s?/g, "") // blockquotes
    .replace(/[*-]\s/g, "") // list bullets
    .trim();
}

/**
 * Draggable chat widget (header = drag handle).
 * Opens only from the "Chat" tab. No floating icon.
 */
const ChatWithYourBook = ({
  endpoint = "chatwithbooks",
  open = false,
  onOpenChange,
}) => {
  const [messages, setMessages] = useState([
    { type: "bot", text: "Ask me anything about the current book." },
  ]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [inputText, setInputText] = useState("");
  const chatBodyRef = useRef(null);
  const selectedBookUrl = useBookStore((state) => state.selectedBookUrl);
  const setGoToPage = useBookStore((state) => state.setGoToPage);

  const { chunks, selectedChunkIndex } = useBookStore();

  // Dragging
  const boxRef = useRef(null);
  const dragData = useRef({
    startX: 0,
    startY: 0,
    baseX: 360,
    baseY: 140,
    dragging: false,
  });

  const setPos = (x, y) => {
    const node = boxRef.current;
    if (!node) return;
    node.style.setProperty("--drag-left", `${x}px`);
    node.style.setProperty("--drag-top", `${y}px`);
  };

  useLayoutEffect(() => {
    setPos(dragData.current.baseX, dragData.current.baseY);
  }, []);

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
    dragData.current.baseX = x;
    dragData.current.baseY = y;
    setPos(x, y);
  };

  const onTouchMove = (e) => {
    if (!dragData.current.dragging) return;
    e.preventDefault();
    const t = e.touches[0];
    const x = Math.max(8, t.clientX - dragData.current.startX);
    const y = Math.max(70, t.clientY - dragData.current.startY);
    dragData.current.baseX = x;
    dragData.current.baseY = y;
    setPos(x, y);
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
    const id = requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages, loading, open]);

  // Streaming call
  const [sessionId] = useState(() => {
    const id = localStorage.getItem("book-chat-session") || crypto.randomUUID();
    localStorage.setItem("book-chat-session", id);
    return id;
  });

  useEffect(() => {
    const uploadPdf = async () => {
      try {
        setUploading(true);
        // Fetch file from public folder
        const response = await fetch(selectedBookUrl);
        const blob = await response.blob();
        const file = new File([blob], "manual.pdf", {
          type: "application/pdf",
        });

        // Prepare form data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_id", "default_user"); // 🔹 set your user_id dynamically if needed

        // Call Flask API
        const res = await axios.post(
          "http://127.0.0.1:5000/chatwithbooks/upload", // 🔹 update with your Flask backend URL
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        console.log("Upload response:", res.data);

        if (res.data.embedding_done) {
          setQuestions(res.data.suggested_questions);
        }
      } catch (error) {
        console.error("Upload failed:", error);
      } finally {
        setUploading(false);
      }
    };

    uploadPdf();
  }, [selectedBookUrl]);

  const handleSendMessage = async ({ text }) => {
    if (!text?.trim()) return;
    setMessages((prev) => [...prev, { type: "user", text }]);
    setLoading(true);

    let botText = "";
    try {
      const response = await fetch(endpoint + "/message", {
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

        console.log(botText, "===botText");
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { type: "bot", text: botText };
          return copy;
        });
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { type: "bot", text: "⚠️ Error streaming response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/chatwithbooks/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      console.log("New chat session:", data);

      // clear UI for fresh chat
      setMessages([]);
    } catch (err) {
      console.error("Error creating new chat:", err);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (!open) return null;

  const handleReferenceClick = (pageNum) => {
    console.log("Go to page:", pageNum);
    setGoToPage(Number(pageNum)); // scroll or navigate to page in PDF viewer
  };

  return (
    <div
      ref={boxRef}
      className="chat-box chat-drag"
      style={{ "--drag-left": "360px", "--drag-top": "140px" }}
    >
      <div
        className="chat-header drag-handle"
        onMouseDown={(e) => {
          if (!e.target.closest?.(".x-btn")) startDrag(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if (e.target.closest?.(".x-btn")) return;
          const t = e.touches[0];
          startDrag(t.clientX, t.clientY);
        }}
      >
        <span>Chat with Book</span>
        <div>
          <button
            className="new-chat"
            onClick={() => handleNewChat()}
            aria-label="Close chat"
            title="Close"
          >
            New chat
          </button>
          <button
            className="insert-selection"
            onClick={() => {
              const selectedText = chunks[selectedChunkIndex].text;
              if (selectedText) {
                setInputText((prev) => selectedText);
              } else {
                alert("No text selected!");
              }
            }}
            style={{
              background: "#10b981",
              color: "white",
              border: "none",
              padding: "10px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Insert Selection
          </button>

          <button
            className="x-btn"
            onClick={() => onOpenChange?.(false)}
            aria-label="Close chat"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div
        className="chat-body"
        ref={chatBodyRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "12px",
          overflowY: "auto",
        }}
      >
        {/* Uploading UI */}
        {uploading && (
          <div
            className="chat-msg bot uploading"
            style={{
              alignSelf: "center",
              background: "#f1f6fd",
              color: "#444",
              padding: "12px 16px",
              borderRadius: "12px",
              fontSize: "14px",
              textAlign: "center",
            }}
          >
            <div className="spinner" style={{ marginBottom: "6px" }} />
            Uploading book… please wait
          </div>
        )}

        {questions && questions.length > 0 && (
          <div
            style={{
              display: "flex",
              alignSelf: "end",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            {questions && questions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  padding: "12px",
                }}
              >
                {questions.map((question, idx) => (
                  <button
                    key={question.slice(0, 4) + idx}
                    onClick={() => setInputText(stripMarkdown(question))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 16px",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#ffffff",
                      color: "#374151",
                      fontSize: "14px",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                      transition: "all 0.2s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f0f7ff";
                      e.currentTarget.style.boxShadow =
                        "0 2px 6px rgba(0, 0, 0, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                      e.currentTarget.style.boxShadow =
                        "0 1px 3px rgba(0, 0, 0, 0.1)";
                    }}
                  >
                    <span style={{ fontSize: "12px", color: "#2563eb" }}>
                      💡
                    </span>
                    <ReactMarkdown>{question}</ReactMarkdown>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
              position: "relative",
            }}
          >
            {msg.type === "bot" ? (
              <>
                {msg.type === "bot" ? (
                  <>
                    <div>
                      {/* Show normal text, but strip out "Reference pages" */}
                      {msg.text.replace(/Reference pages:.*/, "").trim() && (
                        <ReactMarkdown>
                          {msg.text.replace(/Reference pages:.*/, "").trim()}
                        </ReactMarkdown>
                      )}

                      {/* Detect and render references */}
                      {msg.text.includes("Reference pages:") && (
                        <div className="reference-links" style={{ marginTop: "6px" }}>
                          {msg.text
                            .match(/Reference pages:(.*)/)?.[1] // grab everything after "Reference pages:"
                            .split(",")
                            .map((page, i) => {
                              const pageNum = page.trim().replace("===botText", "");
                              return (
                                <span
                                  key={i}
                                  className="page-link"
                                  onClick={() => handleReferenceClick(pageNum)}
                                  style={{
                                    color: "#2563eb",
                                    cursor: "pointer",
                                    marginRight: "8px",
                                    textDecoration: "underline",
                                  }}
                                >
                                  Page {pageNum}
                                </span>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Copy button */}
                    <button
                      onClick={() => copyToClipboard(msg.text)}
                      style={{
                        position: "absolute",
                        bottom: "-4px",
                        right: "6px",
                        fontSize: "12px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#555",
                      }}
                    >
                      📋
                    </button>
                  </>
                ) : (
                  msg.text
                )}

                <button
                  onClick={() => copyToClipboard(msg.text)}
                  style={{
                    position: "absolute",
                    bottom: "-4px",
                    right: "6px",
                    fontSize: "12px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#555",
                  }}
                >
                  📋
                </button>
              </>
            ) : (
              msg.text
            )}
          </div>
        ))}

        {loading && (
          <div
            className="chat-msg bot loader"
            style={{ alignSelf: "flex-start" }}
          >
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        )}
      </div>
      {messages.some((m) => m.type === "user") && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            padding: "8px 12px",
            borderTop: "1px solid #eee",
            flexWrap: "wrap",
          }}
        >
          {["Explain simply", "List key points", "Where is this covered?"].map(
            (chip) => (
              <button
                key={chip}
                onClick={() => setInputText(chip)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "14px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                {chip}
              </button>
            )
          )}
        </div>
      )}

      <ChatInputWidget
        onSendMessage={handleSendMessage}
        inputText={inputText}
        setInputText={setInputText}
      />
    </div>
  );
};

export default ChatWithYourBook;
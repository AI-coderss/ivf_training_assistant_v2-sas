// src/components/Summary/ChatWithBook.jsx
/* eslint-disable no-loop-func */
import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "../ChatInputWidget";
import ReactMarkdown from "react-markdown";
import "../../styles/Summary/ChatWithBook.css"; // Assuming you have styles for this component

const ChatWithBook = ({ book }) => {
  const [chats, setChats] = useState([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [readyToChat, setReadyToChat] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const userId = "default_user";

  /* scroll helper */
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [chats, loading]);

  /* load / embed the chosen book */
  useEffect(() => {
    if (!book) return;

    setChats([
      {
        who: "system",
        msg: `📘 You are now chatting with "${book.title}". Please wait while I load the content…`,
      },
    ]);
    setUploading(true);
    setReadyToChat(false);
    setSuggestedQuestions([]);

    /* fetch the PDF from /public then send to backend */
    fetch("/pdfs" + book.pdfUrl.split("/pdfs")[1])
      .then((r) => r.blob())
      .then((blob) => {
        const fd = new FormData();
        fd.append("file", blob, `${book.title}.pdf`);
        fd.append("user_id", userId);
        return fetch(
          "https://chat-with-your-books-server.onrender.com/chatwithbooks/upload",
          { method: "POST", body: fd }
        );
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.embedding_done) {
          setSuggestedQuestions(data.suggested_questions || []);
          setReadyToChat(true);
        } else {
          throw new Error(data.error || "Embedding failed");
        }
      })
      .catch((err) => {
        console.error("❌ Upload failed:", err);
        setChats((p) => [
          ...p,
          {
            who: "bot",
            msg: "❌ Failed to load book content. Please try again later.",
          },
        ]);
      })
      .finally(() => setUploading(false));
  }, [book]);

  /* send a message (text or audio) */
  const handleSendMessage = async (message) => {
    if (!readyToChat) {
      setChats((p) => [
        ...p,
        { who: "bot", msg: "⚠️ Please wait until the book is fully loaded." },
      ]);
      return;
    }

    const content = message.text || "[Audio Query]";
    setChats((p) => [...p, { who: "me", msg: content }]);
    setLoading(true);

    try {
      const res = await fetch(
        "https://chat-with-your-books-server.onrender.com/chatwithbooks/message",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, user_id: userId }),
        }
      );
      if (!res.ok || !res.body) throw new Error("❌ Server failed to respond.");

      /* stream response */
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let botMsg = "";
      setChats((p) => [...p, { who: "bot", msg: "" }]);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        botMsg += decoder.decode(value, { stream: true });
        setChats((p) => {
          const u = [...p];
          u[u.length - 1] = { who: "bot", msg: botMsg };
          return u;
        });
      }
    } catch (err) {
      console.error("Streaming error:", err);
      setChats((p) => [
        ...p,
        { who: "bot", msg: "❌ Failed to fetch response. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* handle click on suggested question */
  const handleSuggestedClick = (q) => {
    setSuggestedQuestions((prev) => prev.filter((s) => s !== q));
    handleSendMessage({ text: q });
  };

  /* ------------------------------ UI ------------------------------ */
  return (
    <div className="sp-bookchat">
      {/* <- NEW wrapper class */}
      {/* message list */}
      <div className="chat-content">
        {chats.map((c, i) => (
          <div key={i} className={`chat-message ${c.who}`}>
            {c.who === "bot" && (
              <figure className="avatar">
                <img src="/av.gif" alt="AI Avatar" />
              </figure>
            )}
            <div className="message-text">
              <ReactMarkdown>{c.msg}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* embedding loader */}
      {uploading && (
        <div className="embedding-loader">
          <div className="typing-dots">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>Embedding and preparing suggested questions…</p>
        </div>
      )}

      {/* footer + suggestions (only when ready) */}
      {readyToChat && (
        <>
          <div className="chat-footer">
            <ChatInputWidget onSendMessage={handleSendMessage} />
          </div>

          <div className="questions">
            <div className="suggested-questions">
              <p className="suggestion-title">💡 Suggested Questions:</p>
              <div className="suggestion-buttons">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    className="suggestion-btn"
                    onClick={() => handleSuggestedClick(q)}
                  >
                    <ReactMarkdown>{q}</ReactMarkdown>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatWithBook;

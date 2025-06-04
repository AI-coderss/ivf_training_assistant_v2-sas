/* eslint-disable no-loop-func */
import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "../ChatInputWidget";
import ReactMarkdown from "react-markdown";
import "../../styles/Summary/ChatWithBook.css";

const ChatWithBook = ({ book }) => {
  const [chats, setChats] = useState([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [readyToChat, setReadyToChat] = useState(false);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const userId = "default_user";

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, loading]);

  useEffect(() => {
    if (book) {
      setChats([
        {
          who: "system",
          msg: `📚 You are now chatting with "${book.title}".`,
        },
      ]);
      setReadyToChat(false);
      setSuggestedQuestions([]);

      fetch("/pdfs" + book.pdfUrl.split("/pdfs")[1])
        .then((res) => res.blob())
        .then((blob) => {
          const formData = new FormData();
          formData.append("file", blob, book.title + ".pdf");
          formData.append("user_id", userId);
          return fetch(
            "https://chat-with-your-books-server.onrender.com/chatwithbooks/upload",
            {
              method: "POST",
              body: formData,
            }
          );
        })
        .then((res) => res.json())
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
          setChats((prev) => [
            ...prev,
            {
              who: "bot",
              msg: "❌ Failed to load book content. Please try again later.",
            },
          ]);
        });
    }
  }, [book]);

  const handleSendMessage = async (text) => {
    const userMsg = { who: "me", msg: text };
    setChats((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await fetch(
        "https://chat-with-your-books-server.onrender.com/chatwithbooks/message",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            user_id: userId,
          }),
        }
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botMessage = "";
      setChats((prev) => [...prev, { who: "bot", msg: "" }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        botMessage += decoder.decode(value, { stream: true });
        setChats((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { who: "bot", msg: botMessage };
          return updated;
        });
      }
    } catch (err) {
      console.error("Streaming error:", err);
      setChats((prev) => [
        ...prev,
        { who: "bot", msg: "❌ Failed to fetch response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedClick = (q) => {
    if (!readyToChat) return;
    setSuggestedQuestions((prev) => prev.filter((item) => item !== q));
    handleSendMessage(q);
  };

  return (
    <div className="chat-glass-container">
      <div className="chat-header">
        💬 Chat With: {book ? book.title : "Select a book to start"}
      </div>

      <div className="chat-content">
        {chats.map((chat, idx) => (
          <div key={idx} className={`chat-message ${chat.who}`}>
            {chat.who === "bot" && (
              <figure className="avatar">
                <img src="/av.gif" alt="AI Avatar" />
              </figure>
            )}
            <div className="message-text glass-fade">
              <ReactMarkdown>{chat.msg}</ReactMarkdown>
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message bot">
            <figure className="avatar">
              <img src="/av.gif" alt="AI Avatar" />
            </figure>
            <div className="message-text glass-fade">⏳ Thinking...</div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {readyToChat && suggestedQuestions.length > 0 && (
        <div className="suggested-questions">
          <p className="suggestion-title">💡 Suggested Questions:</p>
          <div className="suggestion-buttons">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                className="suggestion-btn"
                onClick={() => handleSuggestedClick(q)}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-footer">
        <ChatInputWidget onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};

export default ChatWithBook;

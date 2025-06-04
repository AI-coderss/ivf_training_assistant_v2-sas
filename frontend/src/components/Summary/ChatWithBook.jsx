/* eslint-disable no-loop-func */
import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "../ChatInputWidget";
import "../../styles/Summary/ChatWithBook.css";

const ChatWithBook = ({ book }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [readyToChat, setReadyToChat] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const chatRef = useRef(null);
  const userId = "default_user"; // For now, static. You can replace with dynamic ID.

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, loading]);

  useEffect(() => {
    if (book) {
      setChatHistory([
        {
          role: "system",
          content: `📚 You are now chatting with "${book.title}".`,
        },
      ]);
      setUploading(true);
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
          setChatHistory((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "❌ Failed to load book content. Please try again later.",
            },
          ]);
        })
        .finally(() => {
          setUploading(false);
        });
    }
  }, [book]);

  const handleSendMessage = async (message) => {
    if (!book) return;

    if (!readyToChat) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⏳ Please wait while the book is being prepared...",
        },
      ]);
      return;
    }

    const userMessage = {
      role: "user",
      content: message.text || message,
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch(
        "https://chat-with-your-books-server.onrender.com/chatwithbooks/message",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage.content,
            user_id: userId,
          }),
        }
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let result = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        result += decoder.decode(value);
        setChatHistory((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: result },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Failed to fetch response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedClick = (question) => {
    if (!readyToChat) return;
    handleSendMessage(question);
    setSuggestedQuestions((prev) => prev.filter((q) => q !== question));
  };

  return (
    <div className="chat-with-book">
      <h4 className="chat-title">
        💬 Chat With: {book ? book.title : "Select a book to start"}
      </h4>

      {uploading && (
        <div className="loader-overlay">
          <div className="loader"></div>
          <p>⏳ Preparing your book... Please wait</p>
        </div>
      )}

      <div className="chat-messages" ref={chatRef}>
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`chat-msg ${msg.role}`}>
            <span>{msg.content}</span>
          </div>
        ))}
        {loading && <div className="chat-msg assistant">⏳ Thinking...</div>}
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

      {readyToChat ? (
        <ChatInputWidget onSendMessage={handleSendMessage} />
      ) : (
        <div className="chat-msg assistant">
          ⏳ Please wait while the book is being prepared...
        </div>
      )}
    </div>
  );
};

export default ChatWithBook;

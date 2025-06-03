// src/components/Summary/ChatWithBook.jsx
import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "../ChatInputWidget";
import "../../styles/Summary/ChatWithBook.css";

const ChatWithBook = ({ book }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  useEffect(() => {
    if (book) {
      setChatHistory([
        { role: "system", content: `You are now chatting with "${book.title}". Ask anything from the book.` },
      ]);
    }
  }, [book]);

  const handleSendMessage = async (message) => {
    if (!book) return;

    const userMessage = {
      role: "user",
      content: message.text ? message.text : "[Audio Query]",
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch("https://your-api.com/chatwithbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookPdfUrl: book.pdfUrl,
          history: [...chatHistory, userMessage],
          message,
        }),
      });

      const data = await response.json();
      const aiMessage = { role: "assistant", content: data.answer || "No response." };

      setChatHistory((prev) => [...prev, aiMessage]);
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

  return (
    <div className="chat-with-book">
      <h4 className="chat-title">💬 Chat With: {book ? book.title : "Select a book to start"}</h4>

      <div className="chat-messages" ref={chatRef}>
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`chat-msg ${msg.role}`}>
            <span>{msg.content}</span>
          </div>
        ))}
        {loading && <div className="chat-msg assistant">⏳ Thinking...</div>}
      </div>

      <ChatInputWidget onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatWithBook;

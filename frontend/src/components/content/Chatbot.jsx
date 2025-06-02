// src/components/content/Chatbot.jsx
import React, { useState, useEffect, useRef } from "react";
import "../../styles/content/Chatbot.css"; // Create this CSS file

const USER_ID = "default_user"; // Or manage this more dynamically
const BACKEND_URL = "http://localhost:5000"; // Your Flask backend URL

const Chatbot = ({
  isVisible,
  onClose,
  selectedBookTitle,
  bookJustUploaded,
}) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentBook, setCurrentBook] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (isVisible && selectedBookTitle) {
      setCurrentBook(selectedBookTitle);
      // Only add the initial bot message if a book has been successfully uploaded and messages are empty or new book
      if (bookJustUploaded) {
        setMessages([
          {
            sender: "bot",
            text: `Hello! I'm ready to answer questions about "${selectedBookTitle}". How can I help you?`,
          },
        ]);
      } else if (messages.length === 0 && selectedBookTitle) {
        // If chatbot is opened and there was already a book selected
        setMessages([
          {
            sender: "bot",
            text: `Continuing our discussion about "${selectedBookTitle}". Ask me anything!`,
          },
        ]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, selectedBookTitle, bookJustUploaded]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = { sender: "user", text: inputValue };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    let accumulatedBotResponse = "";
    let botMessageObj = { sender: "bot", text: "" };
    // Add a placeholder for the bot's message to show it's thinking
    setMessages((prevMessages) => [...prevMessages, botMessageObj]);

    try {
      const response = await fetch(`${BACKEND_URL}/chatwithbooks/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputValue,
          user_id: USER_ID,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.error || `HTTP error! Status: ${response.status}`
        );
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulatedBotResponse += chunk;
        // eslint-disable-next-line no-loop-func
        setMessages((prevMessages) =>
          prevMessages.map((msg, index) =>
            index === prevMessages.length - 1 // Update the last message (bot's placeholder)
              ? { ...msg, text: accumulatedBotResponse }
              : msg
          )
        );
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err.message);
      setMessages((prevMessages) =>
        prevMessages.filter((_, index) => index !== prevMessages.length - 1)
      ); // Remove placeholder
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          sender: "bot",
          text: `Sorry, I encountered an error: ${err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/chatwithbooks/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }, // as per your backend
        body: new URLSearchParams({ user_id: USER_ID }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "Failed to reset chat.");
      }
      setMessages([
        {
          sender: "bot",
          text: currentBook
            ? `Chat reset. Ask me new questions about "${currentBook}"!`
            : "Chat reset. Please select a book to begin.",
        },
      ]);
    } catch (err) {
      console.error("Failed to reset chat:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) {
    return null; // The toggle button is handled by ContentPage
  }

  return (
    <div className={`chatbot-widget ${isVisible ? "" : "closed"}`}>
      <div className="chatbot-header">
        <h3>{currentBook || "Book Assistant"}</h3>
        <div>
          <button
            onClick={handleResetChat}
            className="reset-button"
            title="Reset Chat"
          >
            🔄
          </button>
          <button onClick={onClose} className="close-button" title="Close Chat">
            ✖️
          </button>
        </div>
      </div>
      {currentBook && (
        <div className="chatbot-status">Talking about: {currentBook}</div>
      )}
      <div className="chatbot-messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message-container ${
              msg.sender === "user" ? "user-message" : "bot-message"
            }`}
          >
            <div className="message-bubble">
              {/* <div className="message-sender">{msg.sender === 'user' ? 'You' : 'Assistant'}</div> */}
              <div>{msg.text}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* For auto-scrolling */}
      </div>
      {isLoading && (
        <div className="chatbot-status">Assistant is typing...</div>
      )}
      {error && <div className="error-message">{error}</div>}
      <div className="chatbot-input-area">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) =>
            e.key === "Enter" && !isLoading && handleSendMessage()
          }
          placeholder={
            currentBook ? "Ask about the book..." : "Select a book first..."
          }
          disabled={isLoading || !currentBook}
        />
        <button
          onClick={handleSendMessage}
          disabled={isLoading || !currentBook}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;

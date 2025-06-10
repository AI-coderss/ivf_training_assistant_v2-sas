import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import "../styles/chat.css";

const Chat = () => {
  const [chats, setChats] = useState([
    { msg: "Hi there! How can I assist you today?", who: "bot" },
  ]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
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

  const handleNewMessage = async (data) => {
    if (data.text) {
      setChats((prev) => [...prev, { msg: data.text, who: "me" }]);

      try {
        const response = await fetch(
          "https://ivf-backend-server.onrender.com/stream",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: data.text,
              session_id: sessionId,
            }),
          }
        );

        if (!response.ok || !response.body) {
          throw new Error("Failed to stream response");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiMessage = "";
        setChats((prev) => [...prev, { msg: "", who: "bot" }]);

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          aiMessage += decoder.decode(value, { stream: true });

          // eslint-disable-next-line no-loop-func
          setChats((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { msg: aiMessage, who: "bot" };
            return updated;
          });
        }
      } catch (err) {
        console.error("Streaming error:", err);
        setChats((prev) => [
          ...prev,
          {
            msg: "Sorry, something went wrong with the streaming response.",
            who: "bot",
          },
        ]);
      }
    }
  };

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
            <div className="message-text">
              <ReactMarkdown>{chat.msg}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={scrollAnchorRef} />
      </div>

      <div className="chat-footer">
        <ChatInputWidget onSendMessage={handleNewMessage} />
      </div>

      {/* ✅ Suggested questions sidebar */}
      <div className="suggestion-column">
        <h4 className="suggestion-title">💡 Suggested Questions</h4>
        <div className="suggestion-list">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              className="suggestion-item"
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
    </div>
  );
};

export default Chat;

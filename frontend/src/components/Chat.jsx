import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SearchLoader from "./SearchLoader"; // Import the loader
import "../styles/chat.css";

const Chat = () => {
  const [chats, setChats] = useState([
    { msg: "Hi there! How can I assist you today with your IVF Training?", who: "bot" },
  ]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [webSearchActive, setWebSearchActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // State to control the loader

  const [sessionId] = useState(() => {
    const id = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", id);
    return id;
  });

  const chatContentRef = useRef(null);
  const scrollAnchorRef = useRef(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, isLoading]);

  useEffect(() => {
    fetch("https://ivf-backend-server.onrender.com/suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestedQuestions(data.suggested_questions || []))
      .catch((err) => console.error("Failed to fetch suggestions:", err));
  }, []);

  const handleNewMessage = async (data) => {
    if (!data.text) return;

    setChats((prev) => [...prev, { msg: data.text, who: "me" }]);

    if (webSearchActive) {
      setIsLoading(true);
    }

    const url = webSearchActive
      ? "https://ivf-backend-server.onrender.com/websearch"
      : "https://ivf-backend-server.onrender.com/stream";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: data.text, session_id: sessionId }),
      });

      if (!response.ok || !response.body) throw new Error("Response error");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = "";
      let isFirstChunk = true;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // --- Listen for the web search signal from the backend ---
        if (chunk.includes("[WEB_SEARCH_INITIATED]")) {
          setIsLoading(true);
          // Clear the previous partial (bad) RAG response
          setChats((prev) => {
            const updated = [...prev];
            if (
              updated.length > 0 &&
              updated[updated.length - 1].who === "bot"
            ) {
              updated[updated.length - 1].msg = "";
            }
            return updated;
          });
          aiMessage = ""; // Reset the message accumulator
          continue; // Skip to the next chunk, ignoring the signal string
        }

        // --- Deactivate loader when the actual content stream starts ---
        if (isLoading && isFirstChunk) {
          // If we were loading, but now we have content, stop the loader
          setIsLoading(false);
        }

        // --- Add bot message bubble on the very first data chunk received ---
        if (isFirstChunk) {
          setChats((prev) => [...prev, { msg: "", who: "bot" }]);
          isFirstChunk = false;
        }

        aiMessage += chunk;

        // eslint-disable-next-line no-loop-func
        setChats((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].who === "bot") {
            updated[updated.length - 1].msg = aiMessage;
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("AI response error:", err);
      if (isLoading) setIsLoading(false);
      setChats((prev) => [
        ...prev,
        {
          msg: "Sorry, something went wrong with the response.",
          who: "bot",
        },
      ]);
    }
  };

  return (
    <div className="chat-layout">
      {/* Chat Area */}
      <div className="chat-content" ref={chatContentRef}>
        {chats.map((chat, index) => (
          <div key={index} className={`chat-message ${chat.who}`}>
            {chat.who === "bot" && (
              <figure className="avatar">
                <img src="/av.gif" alt="avatar" />
              </figure>
            )}
            <div className="message-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.msg}</ReactMarkdown>
          
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-message bot">
            <div className="message-text">
              <SearchLoader />
            </div>
          </div>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      {/* Footer & Suggestions */}
      <div className="chat-footer">
        <ChatInputWidget
          onSendMessage={handleNewMessage}
          disabled={isLoading}
        />
        <div className="web-search-toggle-container">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={webSearchActive}
              onChange={() => setWebSearchActive((prev) => !prev)}
            />
            <span className="slider"></span>
          </label>
          <span className="toggle-label">
            🌐 Web Search {webSearchActive ? "On" : "Off"}
          </span>
        </div>
      </div>

      <div className="suggestion-column">
        <h4 className="suggestion-title">💡 Suggested Questions</h4>
        <div className="suggestion-list">
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              className="suggestion-item"
              style={{ "--i": idx }}
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

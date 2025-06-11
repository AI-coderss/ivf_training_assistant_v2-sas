import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import SearchLoader from "./SearchLoader";
import "../styles/chat.css";

const Chat = () => {
  // ------------ STATE ------------
  const [chats, setChats] = useState([
    { msg: "Hi there! How can I assist you today?", who: "bot" },
  ]);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [webSearchActive, setWebSearchActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [sessionId] = useState(() => {
    const id = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", id);
    return id;
  });

  const chatContentRef = useRef(null);
  const scrollAnchorRef = useRef(null);

  // ------------ EFFECTS ------------
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, isLoading]);

  useEffect(() => {
    fetch("https://ivf-backend-server.onrender.com/suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestedQuestions(data.suggested_questions || []))
      .catch((err) => console.error("Failed to fetch suggestions:", err));
  }, []);

  // ------------ HELPERS ------------
  const addLoaderBubble = () => {
    setIsLoading(true);
    setChats((prev) => [...prev, { msg: "", who: "bot", loader: true }]);
  };

  const replaceLoaderWithBotBubble = () => {
    setIsLoading(false);
    setChats((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.loader) {
        updated[updated.length - 1] = { msg: "", who: "bot" };
      }
      return updated;
    });
  };

  // ------------ MAIN SEND ------------
  const handleNewMessage = async ({ text }) => {
    if (!text?.trim()) return;

    setChats((prev) => [...prev, { msg: text, who: "me" }]);

    const url = webSearchActive
      ? "https://ivf-backend-server.onrender.com/websearch"
      : "https://ivf-backend-server.onrender.com/stream";

    if (webSearchActive) addLoaderBubble();

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
      if (!res.ok || !res.body) throw new Error("Response error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let firstChunkArrived = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Signal from backend to show loader
        if (chunk.includes("[WEB_SEARCH_INITIATED]")) {
          if (!isLoading) addLoaderBubble();
          buf = "";
          continue;
        }

        // First real data: replace loader bubble with normal bot bubble
        if (!firstChunkArrived) {
          firstChunkArrived = true;
          if (isLoading) replaceLoaderWithBotBubble();
          else setChats((prev) => [...prev, { msg: "", who: "bot" }]); // RAG path
        }

        buf += chunk;
        // eslint-disable-next-line no-loop-func
        setChats((prev) => {
          const updated = [...prev];
          if (updated[updated.length - 1].who === "bot") {
            updated[updated.length - 1].msg = buf;
          }
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
      if (isLoading) setIsLoading(false);
      setChats((prev) => [
        ...prev,
        { msg: "Sorry, something went wrong.", who: "bot" },
      ]);
    }
  };

  // ------------ RENDER ------------
  return (
    <div className="chat-layout">
      <div className="chat-content" ref={chatContentRef}>
        {chats.map((chat, idx) => (
          <div key={idx} className={`chat-message ${chat.who}`}>
            {chat.who === "bot" && (
              <figure className="avatar">
                <img src="/av.gif" alt="avatar" />
              </figure>
            )}
            <div className="message-text">
              {chat.loader ? (
                <SearchLoader />
              ) : (
                <ReactMarkdown>{chat.msg}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}
        <div ref={scrollAnchorRef} />
      </div>

      {/* -------- Footer -------- */}
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

      {/* ------ Suggested Questions ------ */}
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

import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SearchLoader from "./SearchLoader";
import Mermaid from "./Mermaid";
import "../styles/chat.css";

const Chat = () => {
  const [chats, setChats] = useState([
    {
      msg: "Hi there! How can I assist you today with your IVF Training?",
      who: "bot",
    },
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

    // ✅ Detect if it needs a diagram
    const diagramKeywords = ["diagram", "flowchart", "process map", "chart"];
    const textLower = data.text.toLowerCase();
    const wantsDiagram = diagramKeywords.some((kw) => textLower.includes(kw));

    // ✅ Always use normal LLM stream for the explanation
    const streamUrl = webSearchActive
      ? "https://ivf-backend-server.onrender.com/websearch"
      : "https://ivf-backend-server.onrender.com/stream";

    // ✅ If diagram needed, call /diagram in parallel
    const diagramUrl = "https://ivf-backend-server.onrender.com/diagram";

    try {
      setIsLoading(true);

      // 🚀 Fire both requests in parallel
      const diagramPromise = wantsDiagram
        ? fetch(diagramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: data.text,
              session_id: sessionId,
            }),
          }).then((res) => res.json())
        : Promise.resolve({ syntax: "" });

      const streamResponse = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: data.text, session_id: sessionId }),
      });

      if (!streamResponse.ok || !streamResponse.body) throw new Error("Response error");

      const reader = streamResponse.body.getReader();
      const decoder = new TextDecoder();
      let aiMessage = "";
      let isFirstChunk = true;

      // ✅ Stream LLM text while also waiting for diagram in background
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        if (chunk.includes("[WEB_SEARCH_INITIATED]")) {
          // optional handling for web search
          continue;
        }

        if (isFirstChunk) {
          setChats((prev) => [...prev, { msg: "", who: "bot" }]);
          isFirstChunk = false;
        }

        aiMessage += chunk;

        setChats((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].who === "bot") {
            updated[updated.length - 1].msg = aiMessage;
          }
          return updated;
        });
      }

      // ✅ Diagram finished too — get syntax
      const diagramData = await diagramPromise;
      const diagramSyntax = diagramData.syntax || "";

      // ✅ Append diagram to the same bot message
      if (diagramSyntax.trim()) {
        setChats((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].who === "bot") {
            updated[updated.length - 1].msg += `\n\n\`\`\`mermaid\n${diagramSyntax}\n\`\`\``;
          }
          return updated;
        });
      }

      setIsLoading(false);
    } catch (err) {
      console.error("AI response error:", err);
      setIsLoading(false);
      setChats((prev) => [
        ...prev,
        {
          msg: "Sorry, something went wrong with the response.",
          who: "bot",
        },
      ]);
    }
  };

  // ✅ Split text & render Mermaid inline
  const renderMessage = (message) => {
    const regex = /```mermaid([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(message))) {
      const before = message.slice(lastIndex, match.index);
      const code = match[1];
      if (before) parts.push({ type: "text", content: before });
      parts.push({ type: "mermaid", content: code });
      lastIndex = regex.lastIndex;
    }

    const after = message.slice(lastIndex);
    if (after) parts.push({ type: "text", content: after });

    return parts.map((part, idx) =>
      part.type === "mermaid" ? (
        <Mermaid key={idx} chart={part.content.trim()} />
      ) : (
        <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
          {part.content}
        </ReactMarkdown>
      )
    );
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
            <div className="message-text">{renderMessage(chat.msg)}</div>
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

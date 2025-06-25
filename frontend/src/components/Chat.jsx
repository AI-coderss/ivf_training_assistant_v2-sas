import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";
import HighchartBubble from "./HighChartBubble";
import "../styles/chat.css";

const Chat = () => {
  const [chats, setChats] = useState([
    {
      msg: "Hi there! How can I assist you today with your IVF Training?",
      who: "bot",
    },
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
    if (!data.text) return;

    setChats((prev) => [...prev, { msg: data.text, who: "me" }]);

    const diagramKeywords = ["diagram", "flowchart", "process map", "chart"];
    const textLower = data.text.toLowerCase();
    const wantsDiagram = diagramKeywords.some((kw) => textLower.includes(kw));

    const streamUrl = "https://ivf-backend-server.onrender.com/stream";
    const diagramUrl = "https://ivf-backend-server.onrender.com/diagram";

    const streamPayload = { message: data.text, session_id: sessionId };

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

    try {
      const res = await fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(streamPayload),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let isFirstChunk = true;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        if (isFirstChunk) {
          setChats((prev) => [...prev, { msg: "", who: "bot" }]);
          isFirstChunk = false;
        }

        setChats((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].who === "bot") {
            updated[updated.length - 1].msg = buffer;
          }
          return updated;
        });
      }

      const diagramData = await diagramPromise;
      const diagramSyntax = diagramData.syntax || "";

      if (diagramSyntax.trim()) {
        setChats((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].who === "bot") {
            updated[updated.length - 1].msg += `\n\n\`\`\`mermaid\n${diagramSyntax}\n\`\`\``;
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("AI response error:", err);
      setChats((prev) => [
        ...prev,
        {
          msg: "Sorry, something went wrong with the response.",
          who: "bot",
        },
      ]);
    }
  };

  const renderMessage = (message) => {
    const mermaidPattern = /```mermaid([\s\S]*?)```/g;
    const highchartsPattern = /```__highcharts__([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;

    const pushText = (text) => {
      if (text) {
        parts.push({ type: "text", content: text });
      }
    };

    // Process Mermaid charts
    let match;
    while ((match = mermaidPattern.exec(message))) {
      pushText(message.slice(lastIndex, match.index));
      parts.push({ type: "mermaid", content: match[1].trim() });
      lastIndex = mermaidPattern.lastIndex;
    }

    // After Mermaid, check for Highcharts
    message = message.slice(lastIndex);
    lastIndex = 0;

    while ((match = highchartsPattern.exec(message))) {
      pushText(message.slice(lastIndex, match.index));
      try {
        const json = JSON.parse(match[1]);
        parts.push({ type: "highcharts", content: json });
      } catch (e) {
        console.warn("Failed to parse Highcharts JSON:", e);
      }
      lastIndex = highchartsPattern.lastIndex;
    }

    pushText(message.slice(lastIndex));

    return parts.map((part, idx) => {
      if (part.type === "mermaid") {
        return <Mermaid key={idx} chart={part.content} />;
      } else if (part.type === "highcharts") {
        return <HighchartBubble key={idx} config={part.content} />;
      } else {
        return (
          <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
            {part.content}
          </ReactMarkdown>
        );
      }
    });
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
        <div ref={scrollAnchorRef} />
      </div>

      {/* Footer & Suggestions */}
      <div className="chat-footer">
        <ChatInputWidget onSendMessage={handleNewMessage} />
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

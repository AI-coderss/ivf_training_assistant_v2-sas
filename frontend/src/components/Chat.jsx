import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
      let message = "";
      let isFirstChunk = true;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        if (isFirstChunk) {
          // create a new bot message bubble with empty diagram field
          setChats((prev) => [
            ...prev,
            { msg: "", who: "bot", diagram: "" },
          ]);
          isFirstChunk = false;
        }

        message += chunk;

        setChats((prev) => {
          const updated = [...prev];
          if (
            updated.length > 0 &&
            updated[updated.length - 1].who === "bot"
          ) {
            updated[updated.length - 1].msg = message;
          }
          return updated;
        });
      }

      // when stream done, attach diagram if any
      const diagramData = await diagramPromise;
      const diagramSyntax = diagramData.syntax || "";

      if (diagramSyntax.trim()) {
        setChats((prev) => {
          const updated = [...prev];
          if (
            updated.length > 0 &&
            updated[updated.length - 1].who === "bot"
          ) {
            updated[updated.length - 1].diagram = diagramSyntax;
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

  const renderMessage = (chat) => {
    return (
      <>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {chat.msg}
        </ReactMarkdown>
        {chat.diagram && (
          <Mermaid chart={chat.diagram.trim()} />
        )}
      </>
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
            <div className="message-text">{renderMessage(chat)}</div>
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


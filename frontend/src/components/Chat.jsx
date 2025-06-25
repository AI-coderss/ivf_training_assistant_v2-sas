// Chat.jsx
import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mermaid from "./Mermaid";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
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

    const textLower = data.text.toLowerCase();
    const diagramTriggers = ["diagram", "flowchart", "process map"];
    const chartTriggers = [
      "chart", "bar", "line chart", "pie chart", "column chart",
      "trend", "trends", "historical", "data over time", "evolution", "growth", "decline"
    ];

    const wantsDiagram = diagramTriggers.some((kw) => textLower.includes(kw));
    const wantsChart = chartTriggers.some((kw) => textLower.includes(kw));

    const streamUrl = "https://ivf-backend-server.onrender.com/stream";
    const diagramUrl = "https://ivf-backend-server.onrender.com/diagram";
    const chartUrl = "https://ivf-backend-server.onrender.com/chart";

    const streamPayload = { message: data.text, session_id: sessionId };

    const diagramPromise = wantsDiagram
      ? fetch(diagramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: data.text, session_id: sessionId }),
        }).then((res) => res.json())
      : Promise.resolve({ syntax: "" });

    const chartPromise = wantsChart
      ? fetch(chartUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: data.text, session_id: sessionId }),
        }).then((res) => res.json())
      : Promise.resolve({ chart: null });

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
          setChats((prev) => [...prev, { msg: "", who: "bot", diagram: null, chart: null }]);
          isFirstChunk = false;
        }
        message += chunk;

        setChats((prev) => {
          const updated = [...prev];
          if (updated[updated.length - 1].who === "bot") {
            updated[updated.length - 1].msg = message;
          }
          return updated;
        });
      }

      const diagramData = await diagramPromise;
      const chartData = await chartPromise;

      setChats((prev) => {
        const updated = [...prev];
        if (updated[updated.length - 1].who === "bot") {
          updated[updated.length - 1].diagram = diagramData.syntax || null;
          updated[updated.length - 1].chart = chartData.chart || null;
        }
        return updated;
      });
    } catch (err) {
      console.error("AI response error:", err);
      setChats((prev) => [
        ...prev,
        { msg: "Sorry, something went wrong with the response.", who: "bot" },
      ]);
    }
  };

  const renderMessage = (chat) => {
    return (
      <>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.msg}</ReactMarkdown>
        {chat.diagram && <Mermaid chart={chat.diagram.trim()} />}
        {chat.chart && <HighchartsReact highcharts={Highcharts} options={chat.chart} />}
      </>
    );
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
            <div className="message-text">{renderMessage(chat)}</div>
          </div>
        ))}
        <div ref={scrollAnchorRef} />
      </div>

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
                setSuggestedQuestions((prev) => prev.filter((item) => item !== q));
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

import React, { useState, useEffect, useRef } from "react";
import ChatInputWidget from "./ChatInputWidget";
import ReactMarkdown from "react-markdown";
import "../styles/chat.css";

const Chat = () => {
  const [chats, setChats] = useState([
    { msg: "Hi there! How can I assist you today?", who: "bot" },
  ]);

  const [sessionId] = useState(() => {
    const id = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", id);
    return id;
  });

  const chatContentRef = useRef(null);
  const scrollAnchorRef = useRef(null);

  // ✅ Automatically scroll to bottom when messages update
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  const handleNewMessage = async (data) => {
    if (data.text) {
      setChats((prev) => [...prev, { msg: data.text, who: "me" }]);
   

      try {
        const response = await fetch("https://ivf-backend-server.onrender.com/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: data.text,
            session_id: sessionId,
          }),
        });

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
          { msg: "Sorry, something went wrong with the streaming response.", who: "bot" },
        ]);
      } finally {
       
      }
    }
  };

  return (
    <>
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
        <div ref={scrollAnchorRef} /> {/* ✅ Invisible anchor for scrolling */}
      </div>

      <div className="chat-footer">
        <ChatInputWidget onSendMessage={handleNewMessage} />
      </div>
    </>
  );
};

export default Chat;





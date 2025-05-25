// ======== FRONTEND: Chat.js ========
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import ChatInputWidget from "./ChatInputWidget";
import "../styles/chat.css";

const Chat = () => {
  const [chats, setChats] = useState([
    { msg: "Hi there! How can I assist you today?", who: "bot" },
  ]);
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => {
    const id = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", id);
    return id;
  });
  const chatContentRef = useRef(null);

  useEffect(() => {
    if (chatContentRef.current) {
      chatContentRef.current.scrollTo({
        top: chatContentRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [chats, loading]);

  const handleNewMessage = async (data) => {
    if (data.text) {
      setChats((prev) => [...prev, { msg: data.text, who: "me" }]);
      setLoading(true);

      try {
        const res = await axios.post("https://ivf-backend-server.onrender.com/generate", {
          message: data.text,
          session_id: sessionId,
        });
        const { response } = res.data;
        setChats((prev) => [...prev, { msg: response, who: "bot" }]);
      } catch (err) {
        console.error("Text error:", err);
        setChats((prev) => [
          ...prev,
          { msg: "Sorry, I couldn't process your request. Please try again.", who: "bot" },
        ]);
      } finally {
        setLoading(false);
      }
    } else if (data.audioFile) {
      setLoading(true);
      try {
        const audioBlob = new Blob([new Uint8Array(data.audioFile)], { type: "audio/wav" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.wav");

        const responseRes = await axios.post("https://ivf-backend-server.onrender.com/generate", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const { response } = responseRes.data;
        setChats((prev) => [...prev, { msg: "[Voice Message]", who: "me" }]);
        setChats((prev) => [...prev, { msg: response, who: "bot" }]);
      } catch (err) {
        console.error("Audio error:", err);
        setChats((prev) => [
          ...prev,
          { msg: "Sorry, I couldn't process your voice input. Please try again.", who: "bot" },
        ]);
      } finally {
        setLoading(false);
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
                <img src="/ivf.jpg" alt="avatar" />
              </figure>
            )}
            <div className="message-text">{chat.msg}</div>
          </div>
        ))}

        {loading && (
          <div className="chat-message loading bot">
            <figure className="avatar">
              <img src="/ivf.jpg" alt="avatar" />
            </figure>
            <div style={{ padding: "5px", display: "flex", alignItems: "center" }}>
              <lottie-player
                src="https://lottie.host/d354a5c5-9a8b-456f-a7ed-e88fd09ce683/vYJTHMVdFJ.json"
                style={{ width: "60px", height: "60px" }}
                loop
                autoplay
              ></lottie-player>
            </div>
          </div>
        )}
      </div>

      <div className="chat-footer">
        <ChatInputWidget onSendMessage={handleNewMessage} />
      </div>
    </>
  );
};

export default Chat;




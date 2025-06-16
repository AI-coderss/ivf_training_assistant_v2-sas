import React, { useRef, useState, useEffect } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Mousewheel } from "swiper/modules";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaComment,
  FaPaperPlane,
} from "react-icons/fa";

import "swiper/css";
import "swiper/css/keyboard";
import "swiper/css/mousewheel";

import "../styles/avatarPage/AvatarPage.css"; // The single, updated CSS file

import { createStream, postSdp, chat as apiChat } from "../api";

const AVATARS = [
  {
    id: "ava",
    name: "Dr. Ava",
    img: "/avatars/avatar1.png",
    desc: "Your IVF virtual mentor.",
  },
  {
    id: "zen",
    name: "Prof. Zen",
    img: "/avatars/avatar2.png",
    desc: "Calm, clinical insights.",
  },
  {
    id: "max",
    name: "Mentor Max",
    img: "/avatars/avatar3.png",
    desc: "Data-driven guidance.",
  },
  {
    id: "grace",
    name: "Guide Grace",
    img: "/avatars/avatar4.png",
    desc: "Patient care expert.",
  },
  {
    id: "cole",
    name: "Coach Cole",
    img: "/avatars/avatar5.png",
    desc: "Procedure walkthroughs.",
  },
  {
    id: "tao",
    name: "Tutor Tao",
    img: "/avatars/avatar6.png",
    desc: "Research & best practices.",
  },
];

const ChatMessage = ({ sender, text }) => (
  <div className={`chat-message ${sender}`}>
    <p>{text}</p>
  </div>
);

export default function AvatarPage() {
  const videoRef = useRef();
  const pcRef = useRef();
  const [selected, setSelected] = useState(AVATARS[0].id);
  const [streamId, setStreamId] = useState(null);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [messages, setMessages] = useState([
    { sender: "avatar", text: "Hey, I'm Amber. How can I help you today?" },
  ]);
  const [currentMessage, setCurrentMessage] = useState("");

  const {
    transcript,
    listening,
    browserSupportsSpeechRecognition,
    resetTranscript,
  } = useSpeechRecognition();

  const initWebRTC = async (sdpOffer) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;
    pc.ontrack = (evt) => {
      videoRef.current.srcObject = evt.streams[0];
    };
    await pc.setRemoteDescription({ type: "offer", sdp: sdpOffer });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await postSdp(selected, streamId, answer.sdp);
  };

  const startListening = () =>
    SpeechRecognition.startListening({ continuous: true });
  const stopListening = () => SpeechRecognition.stopListening();

  const handleMicToggle = () => {
    if (listening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  };

  const handleSend = async (messageText) => {
    if (!messageText.trim()) return;

    const userMessage = { sender: "user", text: messageText };
    setMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    resetTranscript();

    let currentStreamId = streamId;
    if (!currentStreamId) {
      try {
        const { streamId: id, sdpOffer } = await createStream(selected);
        setStreamId(id);
        currentStreamId = id;
        await initWebRTC(sdpOffer);
      } catch (error) {
        console.error("Error creating stream:", error);
        setMessages((prev) => [
          ...prev,
          { sender: "avatar", text: "Sorry, I can't connect right now." },
        ]);
        return;
      }
    }

    try {
      const { answer } = await apiChat(selected, currentStreamId, messageText);
      const avatarMessage = { sender: "avatar", text: answer };
      setMessages((prev) => [...prev, avatarMessage]);
    } catch (error) {
      console.error("Error getting chat response:", error);
      const errorMessage = {
        sender: "avatar",
        text: "Sorry, I couldn't process that. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  useEffect(() => {
    if (transcript) {
      setCurrentMessage(transcript);
    }
  }, [transcript]);

  return (
    <div className="avatar-page-container">
      <div className="main-view-wrapper">
        <div className="video-section">
          <div className="video-container">
            <video ref={videoRef} autoPlay playsInline muted />
            <div className="video-controls-overlay">
              <div className="audio-visualizer">
                {listening && (
                  <>
                    <div className="viz-bar"></div>
                    <div className="viz-bar"></div>
                    <div className="viz-bar"></div>
                  </>
                )}
              </div>
              <button
                onClick={handleMicToggle}
                className="overlay-control-button"
              >
                {listening ? (
                  <FaMicrophoneSlash size={20} />
                ) : (
                  <FaMicrophone size={20} />
                )}
              </button>
              <button
                onClick={() => setIsChatVisible(!isChatVisible)}
                className="overlay-control-button"
              >
                <FaComment size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className={`chat-panel ${isChatVisible ? "visible" : ""}`}>
          <div className="chat-header">
            <h3>Conversation</h3>
            <button
              onClick={() => setIsChatVisible(false)}
              className="close-chat-btn"
            >
              ✕
            </button>
          </div>
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <ChatMessage key={index} sender={msg.sender} text={msg.text} />
            ))}
          </div>
          <div className="chat-input-area">
            <input
              type="text"
              placeholder="Type your message..."
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyPress={(e) =>
                e.key === "Enter" && handleSend(currentMessage)
              }
            />
            <button
              onClick={() => handleSend(currentMessage)}
              disabled={!currentMessage}
            >
              <FaPaperPlane />
            </button>
          </div>
        </div>
      </div>

      <div className="bottom-swiper-container">
        <Swiper
          modules={[Keyboard, Mousewheel]}
          slidesPerView="auto"
          centeredSlides
          spaceBetween={20}
          keyboard={{ enabled: true }}
          mousewheel={{ releaseOnEdges: true }}
          grabCursor
          className="avatar-swiper"
        >
          {AVATARS.map((av) => (
            <SwiperSlide key={av.id}>
              <div
                className={`card ${selected === av.id ? "active" : ""}`}
                onClick={() => setSelected(av.id)}
              >
                <img src={av.img} alt={av.name} className="avatar-img" />
                <div className="card-text">
                  <h3>{av.name}</h3>
                  <p>{av.desc}</p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </div>
  );
}

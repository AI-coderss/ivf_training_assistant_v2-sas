import React, { useRef, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Mousewheel } from "swiper/modules";

import "swiper/css";
import "swiper/css/keyboard";
import "swiper/css/mousewheel";

import "../styles/avatarPage/AvatarPage.css"; // Uses the updated CSS above

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

export default function AvatarPage() {
  const videoRef = useRef();
  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [selected, setSelected] = useState(AVATARS[0].id);

  const startListening = () =>
    browserSupportsSpeechRecognition &&
    SpeechRecognition.startListening({ continuous: true });
  const stopListening = () =>
    browserSupportsSpeechRecognition && SpeechRecognition.stopListening();

  const handleSend = async () => {
    if (!selected) return;
    console.log(`Sending transcript for ${selected}: ${transcript}`);
  };

  return (
    <div className="avatar-page-container">
      <main className="main-content">
        {/* This new wrapper helps with alignment and spacing */}
        <div className="content-wrapper">
          <div className="video-container">
            <div className="video-placeholder">
              <p>
                {selected
                  ? `Connected to ${
                      AVATARS.find((a) => a.id === selected).name
                    }`
                  : "Select an Avatar"}
              </p>
            </div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ display: "none" }}
            />
          </div>
          <div className="controls">
            <p className="transcript">
              {transcript || "Press 'Speak' and start talking..."}
            </p>
            <div className="buttons-wrapper">
              <button
                onClick={listening ? stopListening : startListening}
                className="control-btn speak-btn"
              >
                {listening ? "■ Stop" : "🎤 Speak"}
              </button>
              <button
                onClick={handleSend}
                disabled={!transcript}
                className="control-btn send-btn"
              >
                ✉️ Send
              </button>
            </div>
          </div>
        </div>
      </main>

      <div className="bottom-swiper-container">
        <Swiper
          modules={[Keyboard, Mousewheel]}
          slidesPerView="auto"
          centeredSlides={true}
          spaceBetween={20}
          keyboard={{ enabled: true }}
          mousewheel={{ releaseOnEdges: true }}
          grabCursor={true}
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

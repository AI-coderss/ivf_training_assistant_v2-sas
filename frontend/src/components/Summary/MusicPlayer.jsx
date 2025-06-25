import React, { useEffect, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/effect-cards";
import { EffectCards, Mousewheel, Pagination } from "swiper/modules";
import "../../styles/Summary/MusicPlayer.css"; // Assuming you have styles for this component
import useAudioStore from "../../stores/useAudioStore";
import SoundVisualizer from "./SoundVisualizer";

// ─── Track & Cover Imports ──────────────────────────────
import track1_url from "../assets/music/track1.mp3";
import track2_url from "../assets/music/track2.mp3";
import track3_url from "../assets/music/track3.mp3";
import track4_url from "../assets/music/track4.mp3";
import track5_url from "../assets/music/track5.mp3";
import track6_url from "../assets/music/track6.mp3";
import track7_url from "../assets/music/track7.mp3";
import track8_url from "../assets/music/track8.mp3";
import track9_url from "../assets/music/track9.mp3";
import track10_url from "../assets/music/track10.mp3";
import track11_url from "../assets/music/track11.mp3";
import track12_url from "../assets/music/track12.mp3";
import track13_url from "../assets/music/track13.mp3";
import track14_url from "../assets/music/track14.mp3";
import track15_url from "../assets/music/track15.mp3";
import track17_url from "../assets/music/track17.mp3";
import track18_url from "../assets/music/track18.mp3";

import cover1_img from "../assets/images/cover1.jpg";
import cover2_img from "../assets/images/cover2.jpg";
import cover3_img from "../assets/images/cover3.jpg";
import cover4_img from "../assets/images/cover4.jpg";
import cover5_img from "../assets/images/cover5.jpg";
import cover6_img from "../assets/images/cover6.jpg";
import cover7_img from "../assets/images/cover7.jpg";
import cover8_img from "../assets/images/cover8.jpg";
import cover9_img from "../assets/images/cover9.jpg";
import cover10_img from "../assets/images/cover10.jpg";
import cover11_img from "../assets/images/cover11.jpg";
import cover12_img from "../assets/images/cover12.jpg";
import cover13_img from "../assets/images/cover13.jpg";
import cover14_img from "../assets/images/cover14.jpg";
import cover15_img from "../assets/images/cover15.jpg";
import cover18_img from "../assets/images/cover18.jpg";


const tracks = [
  { title: "كتير بنعشق", artist: "شرين عبد الوهاب", url: track1_url, cover: cover1_img },
  { title: "مشاعر", artist: "شرين عبد الوهاب", url: track2_url, cover: cover2_img },
  { title: "مين دا اللي نسيك", artist: "نانسي عجرم", url: track3_url, cover: cover3_img },
  { title: "بحبك وحشتني", artist: "حسين الجسمي", url: track4_url, cover: cover4_img },
    { title: "غريبة الناس", artist: "وائل جسار", url: track18_url, cover: cover18_img },
  { title: "بيت حبيبي", artist: "يارا", url: track5_url, cover: cover5_img },
  { title: "ساعات", artist: "أليسا", url: track6_url, cover: cover6_img },
  { title: "بحك مش حقول تاني", artist: "وائل جسار", url: track13_url, cover: cover13_img },
  { title: "بامارة مين", artist: "احمد فريد", url: track7_url, cover: cover7_img },
  { title: "كلمات", artist: "ماجدة الرومي", url: track8_url, cover: cover8_img },
  { title: "خليني ذكرى", artist: "وائل جسار", url: track9_url, cover: cover9_img },
  { title: "لو كان بخاطري", artist: "امال ماهر | راشد الماجد", url: track10_url, cover: cover10_img },
  { title: "خذني معك", artist: "فضل شاكر", url: track11_url, cover: cover11_img },
  { title: "موجوع", artist: "وائل جسار", url: track12_url, cover: cover12_img },
  { title: "معقول", artist: "فضل شاكر", url: track14_url, cover: cover14_img },
  { title: "على بالي", artist: "شرين عبد الوهاب", url: track15_url, cover: cover15_img },
   { title: "حبيبي بالبونت العريض", artist: "حسين الجسمي", url: track17_url, cover: cover4_img },
];

const MusicPlayer = () => {
  const {
    audio,
    currentTrackIndex,
    isPlaying,
    playPause,
    playTrack,
    nextTrack,
    prevTrack,
    setVolume,
    currentTime,
    duration,
    seek,
    toggleShuffle,
  } = useAudioStore();

  const swiperRef = useRef(null);
  const playlistRef = useRef(null);

  useEffect(() => {
    useAudioStore.getState().setTracks(tracks);
  }, []);

  useEffect(() => {
    if (swiperRef.current?.swiper && currentTrackIndex !== null) {
      swiperRef.current.swiper.slideTo(currentTrackIndex);
    }
  }, [currentTrackIndex]);

  // ✅ Pin active item near top with margin
  useEffect(() => {
    if (playlistRef.current && currentTrackIndex !== null) {
      const activeItem = playlistRef.current.querySelector(".active-playlist-item");
      if (activeItem) {
        const container = playlistRef.current;
        const margin = 25; // pixels of comfortable top margin
        const newScrollTop = activeItem.offsetTop - margin;
        container.scrollTop = newScrollTop >= 0 ? newScrollTop : 0;
      }
    }
  }, [currentTrackIndex]);

  return (
    <main>
      <div className="slider-playlist">
        {/* LEFT COLUMN */}
        <div className="left-column">
          <div className="swiper-container">
            <Swiper
              ref={swiperRef}
              className="swiper"
              effect={"cards"}
              grabCursor
              modules={[EffectCards, Mousewheel, Pagination]}
              initialSlide={0}
              mousewheel={{ invert: false }}
              onSlideChange={(sw) => playTrack(sw.realIndex)}
              cardsEffect={{ perSlideOffset: 9, perSlideRotate: 3 }}
            >
              {tracks.map((track, idx) => (
                <SwiperSlide key={idx}>
                  <img src={track.cover} alt={track.title} />
                  <h1>{track.artist}</h1>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

          <SoundVisualizer />

          <div className="controls">
            <i className="fa-solid fa-shuffle" onClick={toggleShuffle} />
            <i className="fa-solid fa-backward" onClick={prevTrack} />
            <button id="playPauseBtn" onClick={playPause}>
              <i
                className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"}`}
                id="playPauseIcon"
              />
            </button>
            <i className="fa-solid fa-forward" onClick={nextTrack} />
            <div className="volume">
              <i className="fa-solid fa-volume-high" />
              <input
                type="range"
                id="volume-range"
                min="0"
                max="100"
                defaultValue="100"
                onChange={(e) => {
                  const v = e.target.value / 100;
                  audio.volume = v;
                  setVolume(v);
                }}
              />
            </div>
          </div>

          <input
            type="range"
            id="progress-bar"
            value={currentTime}
            min="0"
            max={duration || 0}
            onChange={(e) => seek(Number(e.target.value))}
          />
        </div>

        {/* RIGHT COLUMN - PLAYLIST */}
        <div className="playlist" ref={playlistRef}>
          {tracks.map((track, idx) => (
            <div
              key={idx}
              className={`playlist-item ${
                idx === currentTrackIndex ? "active-playlist-item" : ""
              }`}
              onClick={() => playTrack(idx)}
            >
              <img src={track.cover} alt={track.title} />
              <div className="song">
                <p>{track.artist}</p>
                <p>{track.title}</p>
              </div>
              <i className="fa-regular fa-heart" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
};

export default MusicPlayer;
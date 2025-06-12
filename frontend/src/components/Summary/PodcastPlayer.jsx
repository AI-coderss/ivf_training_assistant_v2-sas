import React, { useState, useRef, useEffect } from "react";
import "../../styles/Summary/PodcastPlayer.css";

const PodcastPlayer = () => {
  const audioRef = useRef(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const fetchAudio = async () => {
    try {
      const response = await fetch(
        "https://your-backend-endpoint.com/get-audio",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ request_by: "PodcastPlayer" }),
        }
      );
      const data = await response.json();
      if (data && data.audioUrl) {
        setPlaylist((prev) => [
          ...prev,
          { ...data, title: data.title || `Audio ${prev.length + 1}` },
        ]);
        setCurrentIndex(playlist.length);
      }
    } catch (error) {
      console.error("Failed to fetch audio:", error);
    }
  };

  const currentAudio = playlist[currentIndex];

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration);
    };

    audio.addEventListener("timeupdate", updateTime);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
    };
  }, []);

  const handleSeek = (e) => {
    const time = (e.target.value / 100) * duration;
    audioRef.current.currentTime = time;
  };

  const handleNext = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="podcast-wrapper floating-player" style={{ top: "10vh" }}>
      <div className="player-toggle-buttons">
        <button
          className="toggle-player-btn"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? <span>-</span> : <span>+</span>}
        </button>
      </div>

      {isVisible && (
        <div className="player-container fade-in">
          <div className={`c-player ${isPlaying ? "playing" : ""}`}>
            <div className="c-player__current-song">
              <div className="c-player__cd">
                <div
                  className="c-player__cd-thumb"
                  style={{
                    backgroundImage: `url('${
                      currentAudio?.image ||
                      "https://f4.bcbits.com/img/a0568269163_16.jpg"
                    }')`,
                  }}
                ></div>
              </div>

              <div className="c-player__playing-now">
                <p>Now Playing</p>
                <h2>{currentAudio?.title || "No Audio Loaded"}</h2>
              </div>

              <div className="c-player__controls">
                <div className="c-player__button btn-prev" onClick={handlePrev}>
                  <i className="fas fa-step-backward"></i>
                </div>
                <div
                  className="c-player__button btn-toggle-play"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? (
                    <i className="fas fa-pause icon-pause"></i>
                  ) : (
                    <i className="fas fa-play icon-play"></i>
                  )}
                </div>
                <div className="c-player__button btn-next" onClick={handleNext}>
                  <i className="fas fa-step-forward"></i>
                </div>
                <div className="c-player__button btn-add" onClick={fetchAudio}>
                  <i className="fas fa-plus"></i>
                </div>
              </div>

              <div className="c-player__progress">
                <div className="c-player__progress-start-time">
                  {formatTime(currentTime)}
                </div>
                <input
                  className="c-player__progress-bar"
                  type="range"
                  value={(currentTime / duration) * 100 || 0}
                  onChange={handleSeek}
                />
                <div className="c-player__progress-end-time">
                  {formatTime(duration)}
                </div>
              </div>

              <audio
                ref={audioRef}
                className="c-player__audio"
                src={currentAudio?.audioUrl || ""}
              ></audio>
            </div>

            <div className="c-player__playlist">
              {playlist.map((track, index) => (
                <div
                  key={index}
                  className={`c-player__song ${
                    index === currentIndex ? "active" : ""
                  }`}
                  onClick={() => setCurrentIndex(index)}
                >
                  <div className="c-player__song-number">{index + 1}</div>
                  <div className="c-player__song-infos">
                    <h3 className="c-player__song-title">{track.title}</h3>
                    <p className="c-player__song-author">
                      {track.singer || "Unknown"}
                    </p>
                  </div>
                  <div className="c-player__song-duration">
                    {track.duration || "--:--"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PodcastPlayer;

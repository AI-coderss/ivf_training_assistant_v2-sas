// src/components/Summary/PodcastPlayer.jsx
import React, { useEffect, useRef, useState } from "react";
import "../../styles/Summary/PodcastPlayer.css";

const SAMPLE_TRACKS = [
  {
    authors: ["Antonio Vivaldi", "Leonard Bernstein"],
    title: "Summer: III - Presto",
    albumArt:
      "https://i.discogs.com/xW2tKm90ICMH8qnSvwhItM_gCDutDzfjMQ4C4dCyWII/rs:fit/g:sm/q:40/h:300/w:300/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTEzMTA1/MDY5LTE1NDgxMzk4/OTAtMzg3Mi5qcGVn.jpeg",
    url:
      "https://archive.org/download/lp_the-four-seasons_antonio-vivaldi-leonard-bernstein-the-new/disc1/01.06.%20Summer%3A%20III%20-%20Presto.mp3"
  },
  {
    authors: ["Johann Sebastian Bach"],
    title: "Toccata And Fugue In D Minor, Bwv 565",
    albumArt:
      "https://ia802303.us.archive.org/8/items/50_best_loved_works_by_bach/50%20Best%20Loved%20Works%20by%20BACH.jpg",
    url:
      "https://archive.org/download/50_best_loved_works_by_bach/001%20Toccata%20And%20Fugue%20In%20D%20Minor%2C%20Bwv%20565%20Excerpt.mp3"
  },
  {
    authors: ["George Frederic Handel"],
    title: "Passacaglia",
    albumArt:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/George_Frideric_Handel_by_Balthasar_Denner.jpg/220px-George_Frideric_Handel_by_Balthasar_Denner.jpg",
    url:
      "https://archive.org/download/george-frideric-handel-passacaglia-from-suite-no-7-in-g-minor/George%20Frideric%20Handel%20%E2%80%94%20Passacaglia%20From%20Suite%20No%207%20In%20G%20Minor.mp3"
  }
];

const PodcastPlayer = () => {
  const [trackId, setTrackId] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekerPosition, setSeekerPosition] = useState(0);
  const audioRef = useRef(null);
  const tickerRef = useRef(null);

  const currentTrack = SAMPLE_TRACKS[trackId];

  useEffect(() => {
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(currentTrack.url);
    audioRef.current.preload = "auto";
    if (isPlaying) audioRef.current.play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  const handlePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      clearInterval(tickerRef.current);
    } else {
      audioRef.current.play();
      tickerRef.current = setInterval(() => {
        if (audioRef.current.currentTime === audioRef.current.duration) {
          audioRef.current.currentTime = 0;
          clearInterval(tickerRef.current);
          setIsPlaying(false);
        }
        setSeekerPosition(audioRef.current.currentTime);
      }, 1000);
    }
    setIsPlaying((prev) => !prev);
  };

  const onSeek = (time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setSeekerPosition(time);
  };

  const formatTime = (t) => {
    if (isNaN(t)) t = 0;
    return `${parseInt(t / 60)}:${String(parseInt(t % 60)).padStart(2, 0)}`;
  };

  return (
    <main className="player">
      <div className="album-art-container">
        <img className="album-art" src={currentTrack.albumArt} alt="Album art" />
      </div>
      <div className="track-meta">
        <div className="track-title">{currentTrack.title}</div>
        <div className="authors">{currentTrack.authors.join(", ")}</div>
      </div>
      <div className="seeker-container">
        <div className="seeker-timestamps">
          <span>{formatTime(seekerPosition)}</span>
          <span>{formatTime(audioRef.current?.duration)}</span>
        </div>
        <Seeker current={seekerPosition} total={audioRef.current?.duration} onSeek={onSeek} />
      </div>
      <div className="player-buttons">
        <button onClick={() => setTrackId((trackId - 1 + SAMPLE_TRACKS.length) % SAMPLE_TRACKS.length)}>⏴</button>
        <button className="play-button" onClick={handlePlay}>
          <PlayButton isPlaying={isPlaying} />
        </button>
        <button onClick={() => setTrackId((trackId + 1) % SAMPLE_TRACKS.length)}>⏵</button>
      </div>
    </main>
  );
};

const PlayButton = ({ isPlaying }) => {
  const path = isPlaying
    ? "M10,10 L10,90 L40,90 L40,10 M90,10 L90,90 L60,90 L60,10 Z"
    : "M10,10 L90,50 L10,90 Z";
  return (
    <svg viewBox="0 0 100 100">
      <path d={path} />
    </svg>
  );
};

const Seeker = ({ current, total, onSeek }) => (
  <input
    type="range"
    min={0}
    max={total}
    value={isNaN(current) ? 0 : current}
    onChange={(e) => onSeek(Number(e.target.value))}
  />
);

export default PodcastPlayer;

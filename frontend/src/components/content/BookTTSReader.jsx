/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from "react";
import useBookStore from "../../store/bookStore";

const MAX_CHARS = 200;

const BookTTSReader = ({ text, onAutoFlip, containerRef }) => {
  const [speed, setSpeed] = useState(1);
  const [audioReady, setAudioReady] = useState(false);
  const {
    chunks,
    setChunks,
    selectedChunkIndex,
    setSelectedChunkIndex,
    selectedTextInfo,
    highlightedWordIndex,
    setHighlightedWordIndex,
    isAutoScrolling,
    setIsAutoScrolling,
    isPlaying,
    setIsPlaying,
  } = useBookStore();
  const [timings, setTimings] = useState([]);
  const audioRef = useRef(null);
  const nextAudioRef = useRef(null);
  const audios = useRef({});

  // Chunking of text into manageable parts
  useEffect(() => {
    if (text) {
      const cleanText = text.replace(/\s+/g, " ").trim();
      const words = cleanText.split(" ");

      let result = [];
      let chunk = "";
      let currentStart = 0;
      let globalIndex = 0; // tracks character position in original cleanText

      for (let word of words) {
        // +1 for the space we add
        if ((chunk + " " + word).length > MAX_CHARS) {
          const chunkText = chunk.trim();
          result.push({
            text: chunkText,
            startIndex: currentStart,
            endIndex: currentStart + chunkText.length - 1,
          });

          // prepare next chunk
          currentStart = globalIndex;
          chunk = word;
        } else {
          if (chunk === "") {
            currentStart = globalIndex; // new chunk start
          }
          chunk += " " + word;
        }

        globalIndex += word.length + 1; // +1 for space
      }

      if (chunk) {
        const chunkText = chunk.trim();
        result.push({
          text: chunkText,
          startIndex: currentStart,
          endIndex: currentStart + chunkText.length - 1,
        });
      }

      setChunks(result);
      setSelectedChunkIndex(0);
      audios.current = [];
      setIsPlaying(false);
    }
  }, [text]);

  // handles selection of text from pdf document
  useEffect(() => {
    if (!selectedTextInfo.text) return;

    const { startIndex, endIndex } = selectedTextInfo;
    console.log(chunks.length);
    const matchedChunks = chunks.filter(
      (chunk) => startIndex >= chunk.startIndex && startIndex <= chunk.endIndex
    );

    if (matchedChunks.length > 0) {
      // You could highlight or set the first one as selected
      setSelectedChunkIndex(chunks.indexOf(matchedChunks[0]));
      setIsPlaying(false);
    } else {
      console.log("No chunk found for selection");
    }
  }, [selectedTextInfo]);

  //converting chunks to audio
  useEffect(() => {
    if (!chunks.length) return;

    let isCancelled = false;
    setAudioReady(false);
    setHighlightedWordIndex(null);

    const loadChunk = async () => {
      const chunkText = chunks[selectedChunkIndex]?.text;
      console.log(
        "sending chunk for audio:",
        chunkText && chunkText.slice(0, 50) + "..."
      );

      // Fetch timings
      const t = await fetchTimings(chunkText);
      if (isCancelled) return;
      setTimings(t);

      // Fetch audio if not cached
      if (!audios.current[selectedChunkIndex]) {
        const a = await fetchChunkAudio(selectedChunkIndex);
        if (isCancelled) return;
        if (a) {
          audios.current[selectedChunkIndex] = a;
        }
      }

      // Only mark ready if audio & timings are both loaded
      setAudioReady(true);
    };

    loadChunk();

    // Optionally preload next chunk audio here too
    if (
      selectedChunkIndex + 1 < chunks.length &&
      !audios.current[selectedChunkIndex + 1]
    ) {
      fetchChunkAudio(selectedChunkIndex + 1).then((nextAudio) => {
        if (nextAudio) audios.current[selectedChunkIndex + 1] = nextAudio;
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedChunkIndex, chunks]);

  useEffect(() => {
    if (!chunks.length) return;
    setAudioReady(false);

    const audio = audios.current[selectedChunkIndex];
    if (audio) {
      // When audio can play, mark ready
      const onCanPlay = () => setAudioReady(true);
      audio.addEventListener("canplaythrough", onCanPlay, { once: true });

      // If already ready, set immediately
      if (audio.readyState >= 4) setAudioReady(true);

      return () => {
        audio.removeEventListener("canplaythrough", onCanPlay);
      };
    }
  }, [selectedChunkIndex, chunks]);

  // Play/pause logic in useEffect when isPlaying changes
  useEffect(() => {
    if (!isPlaying || !audioReady) return;

    const audio = audios.current[selectedChunkIndex];
    if (!audio) return;

    audio.playbackRate = speed;
    audio.play();

    const EPSILON = 0.05;
    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      const currentIdx = timings.findIndex(
        (t) => currentTime + EPSILON >= t.start && currentTime - EPSILON < t.end
      );
      if (currentIdx !== highlightedWordIndex) {
        setHighlightedWordIndex(currentIdx);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);

    const onEnded = () => {
      if (isAutoScrolling && onAutoFlip) onAutoFlip(selectedChunkIndex);
      if (selectedChunkIndex + 1 < chunks.length) {
        setSelectedChunkIndex(selectedChunkIndex + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, [
    isPlaying,
    selectedChunkIndex,
    speed,
    timings,
    isAutoScrolling,
    onAutoFlip,
    highlightedWordIndex,
  ]);

  // Fetch TTS timings for highlighting
  const fetchTimings = async (chunkText) => {
    const res = await fetch("https://immersive-reader-realtime-tts-server.onrender.com/tts-timings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunkText }),
    });
    const data = await res.json();
    return data.timings || [];
  };

  // Fetch audio for a given chunk index
  const fetchChunkAudio = async (chunkIndex) => {
    if (!chunks[chunkIndex]) return null;
    const res = await fetch("https://immersive-reader-realtime-tts-server.onrender.com/tts-chunk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunks[chunkIndex].text }),
    });
    if (!res.ok) return null;
    return new Audio(URL.createObjectURL(await res.blob()));
  };

  const handleSpeedChange = (e) => {
    const newSpeed = parseFloat(e.target.value);
    setSpeed(newSpeed);
    if (audioRef.current) audioRef.current.playbackRate = newSpeed;
    if (nextAudioRef.current) nextAudioRef.current.playbackRate = newSpeed;
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      const audio = audios.current[selectedChunkIndex];
      if (audio) audio.pause();
      setIsPlaying(false);
    } else {
      // Only start playing if audio is ready
      if (audioReady) {
        const audio = audios.current[selectedChunkIndex];
        if (audio) audio.play();
        setIsPlaying(true);
      }
    }
  };
  const handleWordClick = (wordIdx) => {
    const audio = audios.current[selectedChunkIndex];
    if (audio) {
      audio.currentTime = timings[wordIdx]?.start || 0;
      audio.play();
      setIsPlaying(true);
      setHighlightedWordIndex(wordIdx);
    }
  };

  const currentWords = chunks[selectedChunkIndex]?.text?.split(" ") || [];
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "800px",
        margin: "auto auto 0 auto",
        height: "100%",
      }}
    >
      {/* Toolbar - Modern Card Style */}
      <div
        className="glass-card "
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderRadius: "16px",
          marginBottom: "20px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)", // Stronger shadow
          backdropFilter: "blur(12px)", // Glass blur
          WebkitBackdropFilter: "blur(12px)", // Safari support
          border: "1px solid rgba(255, 255, 255, 0.3)", // Subtle border
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        {/* Left side controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Speed Control */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label
              style={{ fontWeight: "600", color: "#000", fontSize: "15px" }}
            >
              Speed:
            </label>
            <select
              value={speed}
              onChange={handleSpeedChange}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                background: "white",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              {[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Centered Play/Pause Button or Loading Indicator */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          {!audioReady ? (
            <div
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: "#f3f4f6",
                color: "#4b5563",
                cursor: "pointer",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  border: "2px solid #e5e7eb",
                  borderTop: "2px solid #4f46e5",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
          ) : (
            <button
              onClick={handlePlayPause}
              style={{
                borderRadius: "100%",
                border: "none",
                background: "rgb(79, 70, 229)",
                color: "white",
                cursor: "pointer",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s",
                width: "50px",
                height: "50px",
              }}
            >
              {isPlaying ? (
                <>
                  <span style={{ fontSize: "18px" }}>⏸</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: "18px" }}>▶</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right side controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            justifyContent: "flex-end",
          }}
        >
          {/* Auto Scroll Toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              cursor: "pointer",
              userSelect: "none",
              fontWeight: "600",
              color: "#3b3b3b",
              fontSize: "15px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "22px",
                borderRadius: "11px",
                background: isAutoScrolling ? "#858b99" : "#e5e7eb",
                position: "relative",
                transition: "background 0.2s",
                boxShadow: "#b3b7bb 0px 7px 20px 2px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "3px",
                  left: isAutoScrolling ? "21px" : "3px",
                  width: "16px",
                  height: "16px",
                  background: "white",
                  borderRadius: "50%",
                  transition: "left 0.2s",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                }}
              />
            </div>
            <input
              type="checkbox"
              checked={isAutoScrolling}
              onChange={() => setIsAutoScrolling(!isAutoScrolling)}
              style={{ display: "none" }}
            />
            Auto Scroll
          </label>

          {/* Progress Indicator */}
          {/* <div
            style={{
              background: "#f3f4f6",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "600",
              color: "#4b5563",
              minWidth: "100px",
              textAlign: "center"
            }}
          >
            {selectedChunkIndex + 1} / {chunks.length}
          </div> */}
        </div>
      </div>

      {/* Text Viewer - Modern Card Style */}
      {/* <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          padding: "20px",
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          lineHeight: "1.6",
          fontSize: "18px"
        }}
      >
        {currentWords.map((word, i) => {
          const isCurrentWord = highlightedWordIndex === i;
          return (
            <span
              id={`word-${selectedChunkIndex}-${i}`}
              key={i}
              style={{
                marginRight: "6px",
                cursor: "pointer",
                fontWeight: isCurrentWord ? "600" : "400",
                background: isCurrentWord ? "#4f46e5" : "transparent",
                color: isCurrentWord ? "white" : "#1f2937",
                padding: isCurrentWord ? "2px 6px" : "0",
                borderRadius: isCurrentWord ? "6px" : "0",
                transition: "all 0.15s ease"
              }}
              onClick={() => handleWordClick(i)}
            >
              {word}
            </span>
          );
        })}
      </div> */}

      {/* CSS for the spinning animation */}
      <style>
        {`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}
      </style>
    </div>
  );
};

export default BookTTSReader;
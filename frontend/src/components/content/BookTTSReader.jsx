
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
  const [voice, setVoice] = useState("alloy");

  const audioRef = useRef(null);
  const nextAudioRef = useRef(null);
  const audios = useRef({});

  // Chunking of text into manageable parts

  // useEffect(() => {
  //   if (text) {
  //     const cleanText = text.replace(/\s+/g, " ").trim();
  //     const words = cleanText.split(" ");

  //     let result = [];
  //     let chunk = "";
  //     let currentStart = 0;
  //     let globalIndex = 0; // tracks character position in original cleanText

  //     for (let word of words) {
  //       // +1 for the space we add
  //       if ((chunk + " " + word).length > MAX_CHARS) {
  //         const chunkText = chunk.trim();
  //         result.push({
  //           text: chunkText,
  //           startIndex: currentStart,
  //           endIndex: currentStart + chunkText.length - 1,
  //         });

  //         // prepare next chunk
  //         currentStart = globalIndex;
  //         chunk = word;
  //       } else {
  //         if (chunk === "") {
  //           currentStart = globalIndex; // new chunk start
  //         }
  //         chunk += " " + word;
  //       }

  //       globalIndex += word.length + 1; // +1 for space
  //     }

  //     if (chunk) {
  //       const chunkText = chunk.trim();
  //       result.push({
  //         text: chunkText,
  //         startIndex: currentStart,
  //         endIndex: currentStart + chunkText.length - 1,
  //       });
  //     }

  //     setChunks(result);
  //     setSelectedChunkIndex(0);
  //     audios.current = [];
  //     setIsPlaying(false);
  //   }
  // }, [text]);

  useEffect(() => {
    if (text) {
      const cleanText = text.replace(/\s+/g, " ").trim();
      const words = cleanText.split(" ");
      const result = [];

      let chunk = "";
      let currentStart = 0;
      let globalIndex = 0;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if ((chunk + " " + word).length > MAX_CHARS) {
          // Look for punctuation near the end of the chunk
          let lastPunct = Math.max(
            chunk.lastIndexOf("."),
            chunk.lastIndexOf(","),
            chunk.lastIndexOf("!"),
            chunk.lastIndexOf("?")
          );

          let splitIndex = lastPunct > 0 ? lastPunct + 1 : chunk.length;

          const chunkText = chunk.slice(0, splitIndex).trim();
          result.push({
            text: chunkText,
            startIndex: currentStart,
            endIndex: currentStart + chunkText.length - 1,
          });

          // Prepare next chunk
          const remaining = chunk.slice(splitIndex).trim();
          chunk = remaining + " " + word;
          currentStart = globalIndex - remaining.length;
        } else {
          if (chunk === "") currentStart = globalIndex;
          chunk += (chunk ? " " : "") + word;
        }
        globalIndex += word.length + 1;
      }

      if (chunk) {
        result.push({
          text: chunk.trim(),
          startIndex: currentStart,
          endIndex: currentStart + chunk.trim().length - 1,
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
  // https://immersive-reader-realtime-tts-server.onrender.com
  // Fetch TTS timings for highlighting
  const fetchTimings = async (chunkText) => {
    const res = await fetch("https://immersive-reader-realtime-tts-server.onrender.com/tts-timings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunkText, voice }),
    });
    const data = await res.json();
    return data.timings || [];
  };
  // https://immersive-reader-realtime-tts-server.onrender.com
  // Fetch audio for a given chunk index
  const fetchChunkAudio = async (chunkIndex) => {
    if (!chunks[chunkIndex]) return null;
    const res = await fetch("https://immersive-reader-realtime-tts-server.onrender.com/tts-chunk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunks[chunkIndex].text, voice: voice }),
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
        maxWidth: "fit-content",
        margin: "auto",
        padding: "10px 20px",
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        background: "white",
        position: "relative",
        zIndex: 90,
      }}
    >
      {/* Speed Control */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <label style={{ fontWeight: "500", fontSize: "14px", color: "#4B5563" }}>
          Speed:
        </label>
        <select
          value={speed}
          onChange={handleSpeedChange}
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            background: "white",
            fontWeight: "500",
            fontSize: "14px",
          }}
        >
          {[0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </div>

      {/* Voice Select */}
      <select
        value={voice}
        onChange={(e) => setVoice(e.target.value)}
        style={{
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid #d1d5db",
          background: "white",
          fontWeight: "500",
          fontSize: "14px",
          minWidth: "80px",
        }}
      >
        {["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"].map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>

      {/* Play / Pause Button */}
      <button
        onClick={handlePlayPause}
        style={{
          borderRadius: "50%",
          border: "none",
          background: "#007BFF",
          color: "white",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      {/* Auto Scroll Toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: "500",
          fontSize: "14px",
          color: "#4B5563",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "20px",
            borderRadius: "10px",
            background: isAutoScrolling ? "#007BFF" : "#E5E7EB",
            position: "relative",
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: isAutoScrolling ? "18px" : "2px",
              width: "16px",
              height: "16px",
              borderRadius: "50%",
              background: "#FFF",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
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
    </div>

  );
};

export default BookTTSReader;
import React, { useEffect, useRef } from "react";
import "../styles/AudioVisualizer.css";
import useAudioStore from "../store/audioStore"; // Make sure path matches your folder structure

const AudioVisualizer = () => {
  const { audioUrl, stopAudio } = useAudioStore(); // audioUrl is expected to be a MediaStream
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!audioUrl) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioUrl);

    source.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const WIDTH = (canvas.width = 800);
    const HEIGHT = (canvas.height = 350);

    const barWidth = (WIDTH / bufferLength) * 2.5;
    let animationId;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i];
        const gradient = ctx.createLinearGradient(
          x,
          HEIGHT - barHeight,
          x,
          HEIGHT
        );
        gradient.addColorStop(0, "#0f0");
        gradient.addColorStop(0.5, "#ff0");
        gradient.addColorStop(1, "#f00");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      analyser.disconnect();
      source.disconnect();
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, [audioUrl, stopAudio]);

  return (
    <div className="audio-visualizer-wrapper">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default AudioVisualizer;

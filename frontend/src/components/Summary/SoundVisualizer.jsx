import React, { useEffect, useRef } from "react";
import useAudioStore from '../stores/useAudioStore';

const SoundVisualizer = () => {
    const analyserNode = useAudioStore((state) => state.analyserNode);
    const canvasRef = useRef(null);
    const animationIdRef = useRef(null);

    useEffect(() => {
        if (!analyserNode || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        const resizeCanvas = () => {
            if (!canvas.parentElement) return;
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        let cheight = canvas.height;
        const meterWidth = 8;
        const gap = 2;
        const meterNum = Math.floor(canvas.width / (meterWidth + gap));
        const capHeight = 2;
        const capStyle = "rgba(255, 255, 255, 0.8)";
        const capYPositionArray = [];

        const gradient = ctx.createLinearGradient(0, 0, 0, cheight);
        gradient.addColorStop(1, "#2b86c5");
        gradient.addColorStop(0.5, "#784ba0");
        gradient.addColorStop(0, "#ff3cac");
        
        const drawMeter = () => {
            if (!analyserNode) return;
            const array = new Uint8Array(analyserNode.frequencyBinCount);
            analyserNode.getByteFrequencyData(array);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            cheight = canvas.height;
            
            for (let i = 0; i < meterNum; i++) {
                const value = array[i * Math.floor(array.length / meterNum)] * (cheight / 255);

                if (capYPositionArray.length < meterNum) capYPositionArray.push(value);
                
                ctx.fillStyle = capStyle;
                if (value < capYPositionArray[i]) {
                    ctx.fillRect(i * (meterWidth + gap), cheight - --capYPositionArray[i], meterWidth, capHeight);
                } else {
                    ctx.fillRect(i * (meterWidth + gap), cheight - value, meterWidth, capHeight);
                    capYPositionArray[i] = value;
                }

                ctx.fillStyle = gradient;
                ctx.fillRect(i * (meterWidth + gap), cheight - value + capHeight, meterWidth, value);
            }
            animationIdRef.current = requestAnimationFrame(drawMeter);
        };
        
        drawMeter();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
        };
    }, [analyserNode]);

    return (
        <div className="sound-visualizer-container">
            <canvas ref={canvasRef}></canvas>
        </div>
    );
};

export default SoundVisualizer;
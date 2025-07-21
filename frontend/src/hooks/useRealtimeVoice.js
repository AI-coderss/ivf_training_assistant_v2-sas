import { useEffect, useRef, useState, useCallback } from "react";

export const useRealtimeVoiceWithStop = ({
  apiBase = `${process.env.REACT_APP_BACKEND_URL}/api` ,
  model = "gpt-4o-realtime-preview-2024-12-17",
  voice = "alloy",
  system = "You are a helpful assistant.",
  context = "",
  audioRef,
} = {}) => {
  const pcRef = useRef(null);
  const startedRef = useRef(false);
  const dcRef = useRef(null);
  const micTrackRef = useRef(null);
  const micStreamRef = useRef(null);
  const closedRef = useRef(false);
  const [transcript, setTranscript] = useState("");
  const [ready, setReady] = useState(false);
  const [responseStream, setResponseStream] = useState(null);
  const [error, setError] = useState(null);
  const [micActive, setMicActive] = useState(false);

  const toggleMic = useCallback((on) => {
    const micTrack = micTrackRef.current;
    if (!micTrack) return;
    micTrack.enabled = on;
    setMicActive(on);
  }, []);

  const endSession = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;

    try {
      toggleMic(false);
      dcRef.current?.send(JSON.stringify({ type: "session.end" }));
      dcRef.current?.close();
    } catch {}

    micTrackRef.current?.stop();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();

    if (audioRef?.current) {
      try {
        audioRef.current.pause();
        if (audioRef.current.srcObject) {
          audioRef.current.srcObject.getTracks().forEach((t) => t.stop());
        }
        audioRef.current.srcObject = null;
      } catch (e) {
        console.warn("Audio cleanup failed:", e);
      }
    }

    if (responseStream) {
      responseStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Failed to stop response stream track:", e);
        }
      });
      setResponseStream(null);
    }

    setReady(false);
    setMicActive(false);
  }, [toggleMic, responseStream, audioRef]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        micStreamRef.current = stream;
        micTrackRef.current = stream.getAudioTracks()[0];

        const { client_secret } = await fetch(
          `${apiBase}/realtime-key?model=${encodeURIComponent(model)}&voice=${encodeURIComponent(voice)}`
        ).then((r) => r.json());

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.ontrack = (e) => {
          const [remoteStream] = e.streams;
          const isMicLoopback = remoteStream.getAudioTracks().some((t) =>
            t.label.toLowerCase().includes("microphone")
          );

          if (!isMicLoopback) {
            setResponseStream(remoteStream);

            if (audioRef?.current) {
              audioRef.current.srcObject = remoteStream;
              audioRef.current.play().catch((err) => {
                console.warn("🔊 Audio play failed:", err);
              });
            }
          }
        };

        pc.addTrack(micTrackRef.current, stream);
        micTrackRef.current.enabled = false;

        const dc = pc.createDataChannel("oai");
        dcRef.current = dc;

        dc.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);

            if (msg.type === "response.audio_transcript.delta" && msg.delta?.content) {
              setTranscript((t) => t + msg.delta.content);
            }

            if (msg.type === "input_audio_buffer.speech_started") {
              setTranscript("");
            }
          } catch {
            setError("Something went wrong while processing the assistant's reply.");
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setError("Lost connection to the assistant. Please refresh and try again.");
            setReady(false);
          }
        };

        await pc.setLocalDescription(await pc.createOffer());
        await new Promise((res) => {
          if (pc.iceGatheringState === "complete") return res();
          pc.onicegatheringstatechange = () =>
            pc.iceGatheringState === "complete" && res();
        });

        const sdpAnswer = await fetch("https://api.openai.com/v1/realtime", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
          body: pc.localDescription.sdp,
        }).then((r) => r.text());

        await pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer });

        dc.onopen = () => {
          dc.send(
            JSON.stringify({
              type: "session.update",
              session: {
                voice,
                instructions: `${system}\n\nContext:\n${context}`,
              },
            })
          );
          setReady(true);
        };
      } catch (err) {
        setError(err.message || "Voice session could not be started. Please check your mic.");
      }
    })();

    return () => {
      endSession();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase, model, voice, system, context, endSession]);

  return {
    transcript,
    toggleMic,
    ready,
    endSession,
    micStream: micStreamRef.current || null,
    responseStream,
    error,
    micActive,
  };
};

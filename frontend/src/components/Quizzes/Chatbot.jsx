/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable no-loop-func */
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import "../../styles/Quizzes/Chatbot.css";

export default function ChatBot({
  title = "AI-Powered Quiz Feedback",
  initialMessage = "👋 Hi! I’m your AI assistant. Type or speak a message to begin!",
  suggested = [
    "What should I study next?",
    "Summarize my mistakes in 5 bullets.",
    "Create a 3-day micro-study plan.",
    "Show my weakest topics and why.",
  ],
}) {
  // messages: [{role:'user'|'bot', html, ts}]
  const [messages, setMessages] = useState(() => [
    { role: "bot", html: initialMessage, ts: ts() },
  ]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [typing, setTyping] = useState(false);

  // accordion state (desktop)
  const [open, setOpen] = useState(true);
  const [chips, setChips] = useState(suggested);

  const shellRef = useRef(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const rafRef = useRef(0);
  const recognitionRef = useRef(null);
  const abortCtrlRef = useRef(null);

  const sessionId = useMemo(() => {
    const id = localStorage.getItem("chatbot-session") || crypto.randomUUID();
    localStorage.setItem("chatbot-session", id);
    return id;
  }, []);

  /* ---------- Speech Recognition (optional) ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.addEventListener("start", () => setRecording(true));
    rec.addEventListener("end", () => setRecording(false));
    rec.addEventListener("result", (e) => {
      const transcript = e.results?.[0]?.[0]?.transcript || "";
      setText(transcript);
      setTimeout(() => handleSend(transcript), 25);
    });

    recognitionRef.current = rec;
    return () => {
      try { rec.abort(); } catch {}
    };
  }, []);

  /* ---------- Keep chat scrolled ---------- */
  useLayoutEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const n = chatRef.current;
      if (n) n.scrollTop = n.scrollHeight;
    });
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [messages, typing]);

  /* ---------- Desktop accordion toggle ---------- */
  const toggleAccordion = () => setOpen((v) => !v);

  /* ---------- Suggested chip click ---------- */
  const useChip = (q) => {
    setChips((prev) => prev.filter((c) => c !== q));
    handleSend(q);
  };

  /* ---------- Stream from backend (AI text unescaped => Markdown renders) ---------- */
  const streamAI = async (userText) => {
    setTyping(true);
    // placeholder bubble to progressively update
    setMessages((prev) => [...prev, { role: "bot", html: "", ts: ts(), _ph: true }]);

    try {
      abortCtrlRef.current?.abort?.();
      const ctrl = new AbortController();
      abortCtrlRef.current = ctrl;

      const res = await fetch(
        "https://ivf-backend-server.onrender.com/quiz-feedback-stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userText, session_id: sessionId }),
          signal: ctrl.signal,
        }
      );
      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let first = true;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (first) {
          first = false;
          setTyping(false);
        }
        full += decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const next = prev.slice();
          const idx = next.findIndex((m) => m._ph);
          const pos = idx !== -1 ? idx : next.length - 1;
          next[pos] = { role: "bot", html: full, ts: next[pos]?.ts || ts() };
          return next;
        });
      }
      setTyping(false);
    } catch {
      setTyping(false);
      setMessages((prev) => prev.filter((m) => !m._ph));
      push("bot", "⚠️ Error: AI Assistant is temporarily unavailable.");
    }
  };

  /* ---------- Send ---------- */
  const handleSend = async (value = text) => {
    const msg = value.trim();
    if (!msg) return;
    push("user", escapeUser(msg)); // sanitize only user
    setText("");
    await streamAI(msg);
    inputRef.current?.focus();
  };

  const onAction = () => {
    if (text.trim()) return handleSend();
    if (recognitionRef.current) {
      setRecording(true);
      recognitionRef.current.start();
    }
  };

  /* ---------- Mobile drag-to-resize (top handle) ---------- */
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const isMobile = () => window.matchMedia("(max-width: 860px)").matches;
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    let startY = 0;
    let startH = 0;
    let dragging = false;

    const onStart = (e) => {
      if (!isMobile()) return;
      dragging = true;
      startY = "touches" in e ? e.touches[0].clientY : e.clientY;
      startH = el.getBoundingClientRect().height;
      document.body.style.userSelect = "none";
    };
    const onMove = (e) => {
      if (!dragging) return;
      const y = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dy = y - startY;
      const nh = clamp(startH - dy, window.innerHeight * 0.5, window.innerHeight * 0.95);
      el.style.height = `${nh}px`;
    };
    const onEnd = () => {
      dragging = false;
      document.body.style.userSelect = "";
    };

    const handle = el.querySelector(".ink-drag-handle");
    handle?.addEventListener("mousedown", onStart);
    handle?.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);

    // default height on mobile so input + bubbles are visible immediately
    if (isMobile()) el.style.height = "78vh";

    return () => {
      handle?.removeEventListener("mousedown", onStart);
      handle?.removeEventListener("touchstart", onStart);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  /* ---------- helpers ---------- */
  function ts() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const push = (role, html) =>
    setMessages((prev) => [...prev, { role, html, ts: ts() }]);
  const escapeUser = (s) =>
    String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

  const hasText = text.trim().length > 0;

  return (
    <div className="ink-chatbot-shell" ref={shellRef} role="region" aria-label="AI feedback chat">
      {/* mobile drag handle */}
      <div className="ink-drag-handle" aria-hidden="true">
        <span />
      </div>

      {/* Header */}
      <div className="ink-chatbot-header">
        <h3 className="ink-chatbot-title">{title}</h3>

        {/* Desktop-only accordion toggle */}
        <button className="ink-acc-btn desktop-only" onClick={toggleAccordion} aria-expanded={open}>
          {open ? "Hide Suggestions" : "Show Suggestions"}
        </button>
      </div>

      {/* Desktop-only accordion content */}
      {open && (
        <div className="ink-acc desktop-only" role="region" aria-label="Suggested questions">
          <div className="ink-acc-content">
            {chips.map((q) => (
              <button key={q} className="chip" onClick={() => useChip(q)}>
                {q}
              </button>
            ))}
            {chips.length === 0 && <span className="chip-empty">All suggestions used 👍</span>}
          </div>
        </div>
      )}

      {/* Chat body */}
      <div className="ink-chatbot-body" ref={chatRef} role="log" aria-live="polite">
        {messages.map((m, i) => (
          <div className={`ink-msg ${m.role}`} key={`${m.ts}-${i}`}>
            {m.role === "bot" ? (
              <div className="md">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="md-p">{children}</p>,
                    ul: ({ children }) => <ul className="md-ul">{children}</ul>,
                    ol: ({ children }) => <ol className="md-ul">{children}</ol>,
                    li: ({ children }) => <li className="md-li">{children}</li>,
                    h1: ({ children }) => <strong className="md-h">{children}</strong>,
                    h2: ({ children }) => <strong className="md-h">{children}</strong>,
                    h3: ({ children }) => <strong className="md-h">{children}</strong>,
                  }}
                >
                  {m.html}
                </ReactMarkdown>
              </div>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: m.html }} />
            )}
            <span className="ink-ts">{m.ts}</span>
          </div>
        ))}

        {typing && (
          <div className="ink-msg bot typing" aria-live="polite">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
      </div>

      {/* Input Dock */}
      <div className="ink-dock">
        <input
          className="ink-input"
          type="text"
          placeholder={recording ? "Listening…" : "Chat in text or start speaking..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) handleSend();
          }}
        />
        <button
          className={`ink-btn ${recording ? "recording" : ""}`}
          aria-label={hasText ? "Send message" : "Start voice input"}
          onClick={onAction}
        >
          {!hasText && !recording && (
            <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
              <path d="M12 14c1.66 0 3-1.34 3-3V5a3 3 0 1 0-6 0v6c0 1.66 1.34 3 3 3z" />
              <path d="M17.3 11a5.3 5.3 0 0 1-10.6 0H5a7 7 0 0 0 14 0h-1.7zM11 19.93V22h2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 8.93z" />
            </svg>
          )}
          {!hasText && recording && <span className="rec-pulse" />}
          {hasText && (
            <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

/* utils */
function ts() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


import React, { useState } from "react";
import ChatWithYourBook from "./ChatWithYourBook";
import "../../styles/content/Tabs.css";

/**
 * Horizontal tabs (full width, no scroll).
 * Under the bar we render compact glass cards for Summarize / Quizzes.
 * Chat opens the draggable window (no floating icon anywhere).
 */
const Tabs = () => {
  const [active, setActive] = useState(null); // "summary" | "quizzes" | "chat" | null

  // Summary state
  const [summaryLength, setSummaryLength] = useState("Medium"); // Short | Medium | Long
  const [summaryMode, setSummaryMode] = useState("Paragraph");  // Paragraph | Bullet Points
  const [summaryNote, setSummaryNote] = useState("");

  // Quiz state
  const [quizChoice, setQuizChoice] = useState("A");            // A | B | C | D
  const [quizCount, setQuizCount] = useState(5);                // 5 | 10 | 15 | 20
  const [quizNote, setQuizNote] = useState("");

  const [chatOpen, setChatOpen] = useState(false);

  const openSummary = () => {
    setActive("summary");
    setChatOpen(false);
    // Do NOT reset selections so user can come back as-is.
    setSummaryNote("");
    setQuizNote("");
  };

  const openQuizzes = () => {
    setActive("quizzes");
    setChatOpen(false);
    // Do NOT reset selections so user can come back as-is.
    setSummaryNote("");
    setQuizNote("");
  };

  const toggleChat = () => {
    if (chatOpen) {
      setChatOpen(false);
      setActive(null);
    } else {
      setChatOpen(true);
      setActive("chat");
    }
    setSummaryNote("");
    setQuizNote("");
  };

  const closeSummary = () => {
    // Hide, keep selections intact
    setActive(null);
  };

  const closeQuizzes = () => {
    // Hide, keep selections intact
    setActive(null);
  };

  // Dummy actions (wire to Flask later)
  const handleGenerateSummary = () => {
    setSummaryNote(
      `Summary request: { length: ${summaryLength}, mode: ${summaryMode} }`
    );
    // TODO: call your Flask endpoint
  };

  const handleGenerateQuiz = () => {
    setQuizNote(
      `Quiz request: { choice: ${quizChoice}, count: ${quizCount} }`
    );
    // TODO: call your Flask endpoint
  };

  return (
    <aside className="tabs-rail" aria-label="Reader tools">
      {/* Full-width, equal-width tabs */}
      <nav className="tabs-bar" role="tablist" aria-orientation="horizontal">
        <button
          className={`tab-pill ${active === "summary" ? "is-active" : ""}`}
          role="tab"
          aria-selected={active === "summary"}
          onClick={openSummary}
          title="Summarize Text"
        >
          Summarize
        </button>

        <button
          className={`tab-pill ${active === "quizzes" ? "is-active" : ""}`}
          role="tab"
          aria-selected={active === "quizzes"}
          onClick={openQuizzes}
          title="Generate Quizzes"
        >
          Quizzes
        </button>

        <button
          className={`tab-pill ${active === "chat" && chatOpen ? "is-active" : ""}`}
          role="tab"
          aria-selected={active === "chat" && chatOpen}
          onClick={toggleChat}
          title="Chat with Book"
        >
          Chat
        </button>

        <span className="tabs-underline" aria-hidden />
      </nav>

      {/* ───────── Panels under the tabs (glassmorphic cards) ───────── */}
      {active === "summary" && (
        <div className="glass-card" role="region" aria-label="Summarize controls">
          <button
            className="card-close"
            aria-label="Close summarize"
            title="Close"
            onClick={closeSummary}
          >
            ✕
          </button>

          <div className="card-row">
            <span className="card-label">Length</span>
            <div className="segmented">
              {["Short", "Medium", "Long"].map((l) => (
                <button
                  key={l}
                  className={`seg-btn ${summaryLength === l ? "is-active" : ""}`}
                  aria-pressed={summaryLength === l}
                  onClick={() => setSummaryLength(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="card-row">
            <span className="card-label">Mode</span>
            <div className="segmented">
              {["Paragraph", "Bullet Points"].map((m) => (
                <button
                  key={m}
                  className={`seg-btn ${summaryMode === m ? "is-active" : ""}`}
                  aria-pressed={summaryMode === m}
                  onClick={() => setSummaryMode(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button className="cta-primary" onClick={handleGenerateSummary}>
            Generate Summary
          </button>

          {summaryNote && <p className="note">{summaryNote}</p>}
        </div>
      )}

      {active === "quizzes" && (
        <div className="glass-card" role="region" aria-label="Quiz controls">
          <button
            className="card-close"
            aria-label="Close quizzes"
            title="Close"
            onClick={closeQuizzes}
          >
            ✕
          </button>

          <div className="choice-tiles" role="group" aria-label="Answer layout">
            {["A", "B", "C", "D"].map((ch) => (
              <button
                key={ch}
                className={`tile ${quizChoice === ch ? "is-active" : ""}`}
                aria-pressed={quizChoice === ch}
                onClick={() => setQuizChoice(ch)}
              >
                {ch}
              </button>
            ))}
          </div>

          <div className="card-row">
            <span className="card-label">Number of Questions</span>
            <div className="segmented wrap">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  className={`seg-btn ${quizCount === n ? "is-active" : ""}`}
                  aria-pressed={quizCount === n}
                  onClick={() => setQuizCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button className="cta-primary" onClick={handleGenerateQuiz}>
            Generate Quiz
          </button>

          {quizNote && <p className="note">{quizNote}</p>}
        </div>
      )}

      {/* Draggable chat (opens/closes only from the Chat tab) */}
      <ChatWithYourBook
        endpoint="/api/chat-with-book/stream"
        open={chatOpen}
        onOpenChange={(v) => {
          setChatOpen(v);
          setActive(v ? "chat" : null);
        }}
      />
    </aside>
  );
};

export default Tabs;



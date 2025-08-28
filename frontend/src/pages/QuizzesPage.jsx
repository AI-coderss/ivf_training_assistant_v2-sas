/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, {
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext,
  useRef,
} from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import io from "socket.io-client";

import ChatBot from "../components/Quizzes/Chatbot";

import "../styles/Quizzes/QuizzesPage.css";
import "../styles/Quizzes/Chatbot.css";

const QuizCtx = createContext(null);
const useQuiz = () => useContext(QuizCtx);

const fmtPct = (n) => (Number.isFinite(n) ? Math.round(n * 100) : 0);
const nowIso = () => new Date().toISOString();
const skillToBand = (s = 0) =>
  s < 1200 ? "Starter" : s < 1500 ? "Medium" : "Difficult";
const skillToLevel = (s = 0) =>
  s < 1200 ? 1 : s < 1350 ? 2 : s < 1500 ? 3 : s < 1650 ? 4 : 5;

export default function QuizzesPage() {
  const [active, setActive] = useState("feedback");
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [lastAttempts, setLastAttempts] = useState([]);
  const [totals, setTotals] = useState({ correct: 0, incorrect: 0 });
  const [toast, setToast] = useState(null);

  // desktop vs mobile – used to ensure a SINGLE ChatBot render
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 860px)").matches
      : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mm = window.matchMedia("(max-width: 860px)");
    const onChange = () => setIsMobile(mm.matches);
    try {
      mm.addEventListener("change", onChange);
    } catch {
      mm.addListener(onChange); // Safari fallback
    }
    return () => {
      try {
        mm.removeEventListener("change", onChange);
      } catch {
        mm.removeListener(onChange);
      }
    };
  }, []);

  useEffect(() => {
    const u = localStorage.getItem("qp_user");
    const s = localStorage.getItem("qp_session");
    if (u) setUser(JSON.parse(u));
    if (s) setSession(JSON.parse(s));
  }, []);

  const ctx = useMemo(
    () => ({
      active,
      setActive,
      session,
      setSession,
      user,
      setUser,
      selectedTopic,
      setSelectedTopic,
      lastAttempts,
      setLastAttempts,
      totals,
      setTotals,
      setToast,
      isMobile,
    }),
    [active, session, user, selectedTopic, lastAttempts, totals, isMobile]
  );

  const lockTabs = ["feedback", "dashboard", "leaderboard", "live"];
  const wrapClass =
    "qp-wrap" + (lockTabs.includes(active) ? " no-outer-scroll" : "");

  return (
    <QuizCtx.Provider value={ctx}>
      <div className={wrapClass}>
        {/* Title intentionally removed */}
        <Header />
        <TabBar active={active} setActive={setActive} />
        <div className="qp-body">
          {active === "quizzes" && <QuizzesTab />}
          {active === "feedback" && (
            <FeedbackTab
              selectedTopic={selectedTopic}
              setSelectedTopic={setSelectedTopic}
              totals={totals}
              lastAttempts={lastAttempts}
            />
          )}
          {active === "leaderboard" && <LeaderboardTab />}
          {active === "dashboard" && (
            <DashboardTab totals={totals} lastAttempts={lastAttempts} />
          )}
          {active === "live" && <LiveChatTab />}
        </div>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </QuizCtx.Provider>
  );
}

function Header() {
  const { session, user } = useQuiz();
  return (
    <div className="qp-header">
      <div style={{ flex: 1 }} />
      <div className="header-right">
        <BadgePill label={`XP ${session?.xp ?? 0}`} />
        <BadgePill label={`Streak ${session?.streak ?? 0}`} />
        <BadgePill label={`Level ${skillToLevel(session?.skill || 0)}`} />
        <span className="user-name">{user?.name ?? "Guest"}</span>
      </div>
    </div>
  );
}

function TabBar({ active, setActive }) {
  const tabs = [
    { id: "quizzes", label: "Quizzes" },
    { id: "feedback", label: "AI Feedback" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "dashboard", label: "Dashboard" },
    { id: "live", label: "Live Chat" },
  ];
  return (
    <div className="tabs">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          className={`tab ${active === t.id ? "active" : ""} ${
            i === 0 ? "first" : ""
          } ${i === tabs.length - 1 ? "last" : ""}`}
        >
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
function BadgePill({ label }) {
  return <div className="badge-pill">{label}</div>;
}
function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className="toast">{message}</div>;
}

/* ---------------------- QUIZZES ---------------------- */
function QuizzesTab() {
  const {
    session,
    setSession,
    user,
    setUser,
    setActive,
    setLastAttempts,
    setTotals,
    setToast,
  } = useQuiz();

  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [hint, setHint] = useState(null);
  const [cooldown, setCooldown] = useState(false);

  useEffect(() => {
    if (!user) {
      const name =
        localStorage.getItem("qp_name") ||
        `User_${Math.floor(Math.random() * 9999)}`;
      const cohort = "default";
      const u = { name, cohort };
      setUser(u);
      localStorage.setItem("qp_user", JSON.stringify(u));
    }
  }, [user, setUser]);

  const startSession = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.name || "Guest",
          cohort: user?.cohort || "default",
        }),
      });
      const data = await r.json();
      setSession(data.session);
      localStorage.setItem("qp_session", JSON.stringify(data.session));
      await nextQuestion(data.session.session_id);
      setToast("Session started. Good luck!");
    } catch (e) {
      console.error(e);
      setToast("Could not start session.");
    } finally {
      setLoading(false);
    }
  };

  const nextQuestion = async (sid = session?.session_id) => {
    if (!sid) return;
    setSelected(null);
    setHint(null);
    setLoading(true);
    try {
      const r = await fetch(
        `/api/session/next_question?session_id=${encodeURIComponent(sid)}`
      );
      const data = await r.json();
      setQuestion(data.question);
      setTimeLeft(120);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!question) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [question?.id]);

  const requestHint = async () => {
    if (!session) return;
    try {
      const r = await fetch("/api/session/submit_attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.session_id,
          question_id: question.id,
          answer_index: null,
          request_hint: true,
        }),
      });
      const data = await r.json();
      setHint(data.hint);
      setSession(data.session);
      localStorage.setItem("qp_session", JSON.stringify(data.session));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (timeout = false) => {
    if (!session || !question) return;
    if (cooldown) return;
    setCooldown(true);
    setTimeout(() => setCooldown(false), 1200);

    try {
      const r = await fetch("/api/session/submit_attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.session_id,
          question_id: question.id,
          answer_index: timeout ? null : selected,
          elapsed_sec: 120 - timeLeft,
        }),
      });
      const data = await r.json();
      setSession(data.session);
      localStorage.setItem("qp_session", JSON.stringify(data.session));
      setLastAttempts(data.last_attempts);
      setTotals(data.totals);
      if (data.events?.includes("level_up"))
        setToast("Level up! Moving to Medium.");
      if (data.events?.includes("level_up2"))
        setToast("Great work! Moving to Difficult.");
      if (data.events?.includes("streak"))
        setToast(`🔥 Streak x${data.session.streak}!`);
      if (data.next_available) await nextQuestion();
      else setToast("You’re done for now — see Feedback tab.");
    } catch (e) {
      console.error(e);
    }
  };

  const finalize = async () => {
    if (!session) return;
    await fetch("/api/session/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session.session_id }),
    });
    setActive("feedback");
  };

  if (!session) {
    return (
      <div className="start-center">
        <button
          className="btn btn-primary big"
          disabled={loading}
          onClick={startSession}
        >
          {loading ? "Starting…" : "Start Session"}
        </button>
      </div>
    );
  }

  return (
    <div className="quizzes-tab scrollable-hidden">
      <div className="quiz-topbar">
        <BadgePill
          label={`Difficulty: ${
            question?.difficulty ?? skillToBand(session?.skill)
          }`}
        />
        <BadgePill label={`Timer: ${Math.max(0, timeLeft)}s`} />
        <BadgePill label={`Topic: ${question?.topic ?? "-"}`} />
        <button className="btn ghost" onClick={finalize}>
          Finish
        </button>
      </div>

      {question ? (
        <div className="q-card">
          <div className="q-head">
            <h3 className="q-title">Q: {question.text}</h3>
            <span className="pill">{question.type}</span>
          </div>

          {question.type === "MCQ" ? (
            <div className="options">
              {question.options.map((opt, idx) => (
                <label
                  key={idx}
                  className={`opt ${selected === idx ? "sel" : ""}`}
                >
                  <input
                    type="radio"
                    name="opt"
                    onChange={() => setSelected(idx)}
                    checked={selected === idx}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              className="free-text"
              placeholder="Type your answer (True/False or short rationale)"
              value={selected?.text ?? ""}
              onChange={(e) => setSelected({ text: e.target.value })}
              rows={5}
            />
          )}

          <div className="actions">
            <button
              className="btn btn-primary"
              onClick={() => handleSubmit(false)}
              disabled={selected === null}
            >
              Submit
            </button>
            <button className="btn ghost" onClick={requestHint}>
              Hint (-XP)
            </button>
            <button
              className="btn ghost"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Back to Top
            </button>
          </div>

          {hint && (
            <div className="hint">
              <strong>Hint:</strong> {hint}
            </div>
          )}

          <div className="cites">
            <strong>References:</strong>{" "}
            {(question.citations || []).map((c, i) => (
              <a key={i} href={c.url} target="_blank" rel="noreferrer">
                {c.id}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="q-card">Fetching your next question…</div>
      )}
    </div>
  );
}

/* --------------------- AI FEEDBACK --------------------- */
function FeedbackTab({ selectedTopic, setSelectedTopic, totals, lastAttempts }) {
  const { isMobile } = useQuiz();

  const correct = totals.correct || 0;
  const incorrect = totals.incorrect || 0;

  const byTopic = useMemo(() => {
    const map = {};
    lastAttempts.forEach((a) => {
      if (!map[a.topic]) map[a.topic] = { correct: 0, total: 0 };
      map[a.topic].total += 1;
      if (a.correct) map[a.topic].correct += 1;
    });
    return map;
  }, [lastAttempts]);

  const topicMastery = useMemo(() => {
    const data = Object.entries(byTopic).map(([topic, v]) => ({
      name: topic,
      y: v.total ? v.correct / v.total : 0,
      events: { click: () => setSelectedTopic(topic) },
    }));
    return {
      chart: { type: "pie", spacing: [8, 8, 8, 8] },
      title: { text: "Topic Mastery" },
      tooltip: { pointFormat: "<b>{point.percentage:.1f}%</b> mastery" },
      series: [{ name: "Mastery", data }],
      credits: { enabled: false },
    };
  }, [byTopic, setSelectedTopic]);

  const ratioPie = {
    chart: { type: "pie", spacing: [8, 8, 8, 8] },
    title: { text: "Correct vs Incorrect" },
    series: [
      {
        name: "Attempts",
        data: [
          { name: "Correct", y: correct },
          { name: "Incorrect", y: incorrect },
        ],
      },
    ],
    credits: { enabled: false },
  };

  // --- Mobile floating chat (single render only on mobile) ---
  const floatRef = useRef(null);
  const handleRef = useRef(null);
  const [floatingOpen, setFloatingOpen] = useState(true);

  useEffect(() => {
    if (!isMobile) return; // only attach handlers on mobile
    const root = floatRef.current;
    const handle = handleRef.current;
    if (!root || !handle) return;

    let startY = 0;
    let startH = 0;
    let dragging = false;

    const onStart = (e) => {
      dragging = true;
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      startH = root.getBoundingClientRect().height;
      root.classList.add("dragging");
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging) return;
      const y = (e.touches ? e.touches[0].clientY : e.clientY);
      const dy = startY - y; // up = increase height
      let newH = Math.max(200, Math.min(window.innerHeight * 0.92, startH + dy));
      root.style.height = `${newH}px`;
    };

    const onEnd = () => {
      dragging = false;
      root.classList.remove("dragging");
    };

    handle.addEventListener("mousedown", onStart);
    handle.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);

    return () => {
      handle.removeEventListener("mousedown", onStart);
      handle.removeEventListener("touchstart", onStart);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, [isMobile, floatingOpen]);

  return (
    <div className="feedback-grid">
      {/* Charts column */}
      <div className="feedback-left">
        <div className="chart-card chart-fill hc-flex">
          <HighchartsReact
            highcharts={Highcharts}
            options={ratioPie}
            containerProps={{ style: { height: "100%", width: "100%" } }}
          />
        </div>
        <div className="chart-card chart-fill hc-flex">
          <HighchartsReact
            highcharts={Highcharts}
            options={topicMastery}
            containerProps={{ style: { height: "100%", width: "100%" } }}
          />
        </div>
      </div>

      {/* SINGLE ChatBot render:
          - Desktop: embedded panel
          - Mobile: floating draggable */}
      {!isMobile ? (
        <div className="feedback-right">
          <div className="chat-card desktop-chat">
            <ChatBot
              title="AI-Powered Quiz Feedback"
              suggested={[
                "What are my weakest topics?",
                "Create a 3-day micro-study plan.",
                "Explain why I missed recent questions.",
                "How can I raise accuracy next week?",
              ]}
              initialMessage={
                selectedTopic
                  ? `Give me feedback focused on: ${selectedTopic}`
                  : "Give me feedback on my latest quiz performance."
              }
            />
          </div>
        </div>
      ) : (
        <>
          <button
            className="float-toggle"
            onClick={() => setFloatingOpen((v) => !v)}
          >
            {floatingOpen ? "Hide AI" : "Show AI"}
          </button>

          <div
            ref={floatRef}
            className={`float-chat ${floatingOpen ? "open" : ""}`}
            aria-hidden={!floatingOpen}
          >
            <div ref={handleRef} className="float-handle" />
            <ChatBot
              title="AI-Powered Quiz Feedback"
              suggested={[
                "What are my weakest topics?",
                "Create a 3-day micro-study plan.",
                "Explain why I missed recent questions.",
                "How can I raise accuracy next week?",
              ]}
              initialMessage={
                selectedTopic
                  ? `Give me feedback focused on: ${selectedTopic}`
                  : "Give me feedback on my latest quiz performance."
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------- LEADERBOARD (static) --------------------- */
function LeaderboardTab() {
  const [period, setPeriod] = useState("all_time");
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);

  const demoRows = [
    { user_id: "u1", name: "Sarah Chen", xp: 2150, streak: 12, skill: 1650 },
    { user_id: "u2", name: "Alex Rodriguez", xp: 1850, streak: 8, skill: 1550 },
    { user_id: "u3", name: "Emma Wilson", xp: 1650, streak: 6, skill: 1500 },
    { user_id: "u4", name: "David Kim", xp: 1420, streak: 4, skill: 1400 },
    { user_id: "u5", name: "Maya Patel", xp: 1380, streak: 7, skill: 1380 },
    { user_id: "u6", name: "BI DSAH", xp: 1250, streak: 5, skill: 1360 },
    { user_id: "u7", name: "Noah Lee", xp: 1180, streak: 3, skill: 1330 },
    { user_id: "u8", name: "Ava Brown", xp: 1100, streak: 2, skill: 1300 },
  ];
  const demoMe = { user_id: "u6", rank: 6, xp: 1250, streak: 5, total_players: 10 };

  const fetchLB = async (p = period) => {
    try {
      const r = await fetch(`/api/leaderboard?period=${p}`);
      const data = await r.json();
      setRows(Array.isArray(data.rows) ? data.rows : demoRows);
      setMe(data.me || demoMe);
    } catch {
      setRows(demoRows);
      setMe(demoMe);
    }
  };
  useEffect(() => { fetchLB(); }, [period]);

  const top = (rows.length ? rows : demoRows).slice(0, 6);
  const categories = top.map(r => r.name);
  const data = top.map(r => r.xp);

  const chartOptions = useMemo(
    () => ({
      chart: { type: "bar", spacing: [8, 8, 12, 8], animation: false },
      title: { text: "Competition" },
      xAxis: {
        categories,
        title: { text: null },
        lineColor: "#dfe6f3",
        tickColor: "#cfd9ee",
        tickLength: 5,
        labels: { enabled: true, style: { fontSize: "11px" } },
      },
      yAxis: {
        min: 0,
        title: { text: "XP", align: "high" },
        gridLineColor: "#eef2f7",
        labels: { enabled: true, style: { fontSize: "11px" } },
      },
      legend: { enabled: false },
      tooltip: { pointFormat: "<b>{point.y} XP</b>" },
      plotOptions: {
        series: {
          animation: false,
          borderRadius: 6,
          pointPadding: 0.08,
          groupPadding: 0.06,
          color: "#2790ff",
        },
      },
      series: [{ name: "XP", data }],
      credits: { enabled: false },
    }),
    // eslint-disable-next-line
    [period, rows]
  );

  const medal = (rank) =>
    rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";

  return (
    <div className="leaderboard fullheight-section">
      <div className="leaderboard-grid">
        <div className="lb-left">
          <div className="lb-filters">
            {["daily", "weekly", "monthly", "all_time"].map((p) => (
              <button
                key={p}
                className={`btn ${period === p ? "btn-primary" : "ghost"}`}
                onClick={() => setPeriod(p)}
              >
                {p.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="chart-card chart-fill hc-flex">
            <HighchartsReact
              highcharts={Highcharts}
              options={chartOptions}
              containerProps={{ style: { height: "100%", width: "100%" } }}
            />
          </div>
        </div>

        <div className="lb-right">
          <div className="table-viewport no-scrollbar">
            <table className="table lb-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User</th>
                  <th>XP</th>
                  <th>Streak</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {(rows.length ? rows : demoRows).map((r, i) => {
                  const rank = i + 1;
                  const isMe = me?.user_id === r.user_id;
                  return (
                    <tr key={r.user_id} className={`${isMe ? "me" : ""}`}>
                      <td>
                        <span className="rank-cell">
                          <span className="medal-emoji">{medal(rank)}</span>
                          <span className="rank-num">{rank}</span>
                        </span>
                      </td>
                      <td>{r.name}{isMe ? " (You)" : ""}</td>
                      <td>{r.xp}</td>
                      <td>🔥 {r.streak}</td>
                      <td>{skillToLevel(r.skill || 1300)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {me && (
            <div className="me-card">
              <strong>Your Rank:</strong> #{me.rank} • XP {me.xp} • Streak{" "}
              {me.streak} • Players {me.total_players}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------- DASHBOARD ---------------------- */
function DashboardTab({ totals, lastAttempts }) {
  const [daysWindow, setDaysWindow] = useState(7);
  const [diffFilter, setDiffFilter] = useState({
    Starter: true,
    Medium: true,
    Difficult: true,
  });

  const [accuracySeries, setAccuracySeries] = useState([]);
  const [growthSeries, setGrowthSeries] = useState([]);
  const [difficultyData, setDifficultyData] = useState([]);

  const smooth = (arr, w = 3) => {
    if (arr.length <= w) return arr;
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const a = Math.max(0, i - (w - 1));
      const b = i + 1;
      const slice = arr.slice(a, b);
      out.push(slice.reduce((s, x) => s + x, 0) / slice.length);
    }
    return out;
  };

  useEffect(() => {
    const byDay = {};
    const push = (ts, correct) => {
      const d = new Date(ts).toISOString().slice(0, 10);
      if (!byDay[d]) byDay[d] = { correct: 0, total: 0 };
      byDay[d].total += 1;
      if (correct) byDay[d].correct += 1;
    };

    if (lastAttempts.length) {
      lastAttempts.forEach((a) => push(a.ts || Date.now(), a.correct));
    } else {
      const today = new Date();
      for (let i = 50; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const total = 3 + (i % 4);
        const correct = Math.max(0, total - (i % 3));
        for (let j = 0; j < total; j++) push(d, j < correct);
      }
    }

    const days = Object.keys(byDay).sort();
    const last = days.slice(-daysWindow);

    const raw = last.map((d) => (byDay[d].total ? byDay[d].correct / byDay[d].total : 0));
    const smoothed = smooth(raw, 4);

    setAccuracySeries([
      { name: "Accuracy", data: last.map((d, i) => [Date.parse(d), smoothed[i]]) },
    ]);

    setGrowthSeries([
      { name: "Attempts", data: last.map((d) => [Date.parse(d), byDay[d].total]) },
    ]);
  }, [lastAttempts, daysWindow]);

  useEffect(() => {
    const base = { Starter: 6, Medium: 5, Difficult: 4 };
    lastAttempts.forEach((a) => {
      const k = a.difficulty || "Starter";
      base[k] = (base[k] || 0) + 1;
    });
    const data = Object.entries(base)
      .filter(([name]) => diffFilter[name])
      .map(([name, y]) => ({ name, y }));
    setDifficultyData(data);
  }, [lastAttempts, diffFilter]);

  const accuracyCfg = {
    chart: { type: "spline", spacing: [8, 8, 14, 8] },
    title: { text: "Performance Trend" },
    xAxis: {
      type: "datetime",
      lineColor: "#dfe6f3",
      tickColor: "#cfd9ee",
      tickLength: 5,
      labels: { enabled: true, style: { fontSize: "11px" } },
    },
    yAxis: {
      min: 0, max: 1,
      lineColor: "#dfe6f3",
      tickColor: "#cfd9ee",
      labels: { formatter() { return `${fmtPct(this.value)}%`; }, style: { fontSize: "11px" } },
    },
    tooltip: { pointFormat: "<b>{point.y:.2f}</b> accuracy" },
    plotOptions: { spline: { lineWidth: 3, marker: { enabled: false } } },
    series: accuracySeries,
    credits: { enabled: false },
  };

  const growthCfg = {
    chart: { type: "column", spacing: [8, 8, 14, 8] },
    title: { text: "Growth Over Time" },
    xAxis: {
      type: "datetime",
      lineColor: "#dfe6f3",
      tickColor: "#cfd9ee",
      tickLength: 5,
      labels: { enabled: true, style: { fontSize: "11px" } },
    },
    yAxis: {
      title: { text: null },
      labels: { enabled: true, style: { fontSize: "11px" } },
    },
    tooltip: { pointFormat: "<b>{point.y}</b> attempts" },
    series: growthSeries,
    credits: { enabled: false },
  };

  const difficultyCfg = {
    chart: { type: "pie", spacing: [8, 8, 14, 8] },
    title: { text: "Difficulty Breakdown" },
    tooltip: { pointFormat: "<b>{point.y}</b> items" },
    plotOptions: {
      pie: { allowPointSelect: true, dataLabels: { enabled: true, format: "{point.name}" } },
    },
    series: [{ name: "Items", data: difficultyData }],
    credits: { enabled: false },
  };

  const totalCompleted = (totals.correct || 12) + (totals.incorrect || 6);
  const overallAcc =
    Math.round(((totals.correct || 12) / Math.max(1, totalCompleted)) * 100) ||
    0;

  return (
    <div className="dashboard-grid">
      <div className="chart-card chart-fill row1 hc-flex">
        <div className="chart-actions">
          <div className="seg">
            {[3, 7, 30, 40].map((d) => (
              <button
                key={d}
                className={`seg-btn ${daysWindow === d ? "active" : ""}`}
                onClick={() => setDaysWindow(d)}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <HighchartsReact
          highcharts={Highcharts}
          options={accuracyCfg}
          containerProps={{ style: { height: "100%", width: "100%" } }}
        />
      </div>

      <div className="kpi-row">
        <div className="kpi card">
          <span>Quizzes Completed</span>
          <strong>{totalCompleted}</strong>
        </div>
        <div className="kpi card">
          <span>Overall Accuracy</span>
          <strong>{overallAcc}%</strong>
        </div>
      </div>

      <div className="chart-pair row3">
        <div className="chart-card chart-fill hc-flex">
          <div className="seg seg-inline">
            {["Starter", "Medium", "Difficult"].map((k) => (
              <button
                key={k}
                className={`seg-btn ${diffFilter[k] ? "active" : ""}`}
                onClick={() =>
                  setDiffFilter((p) => ({ ...p, [k]: !p[k] }))
                }
              >
                {k}
              </button>
            ))}
          </div>
          <HighchartsReact
            highcharts={Highcharts}
            options={difficultyCfg}
            containerProps={{ style: { height: "100%", width: "100%" } }}
          />
        </div>
        <div className="chart-card chart-fill hc-flex">
          <HighchartsReact
            highcharts={Highcharts}
            options={growthCfg}
            containerProps={{ style: { height: "100%", width: "100%" } }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------- LIVE CHAT ---------------------- */
function LiveChatTab() {
  const { user } = useQuiz();
  const [socket, setSocket] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const room = `cohort:${user?.cohort || "default"}`;

  useEffect(() => {
    const s = io("/", { path: "/socket.io" });
    setSocket(s);
    s.emit("join", { room, name: user?.name });
    s.on("message", (m) => setMsgs((prev) => [...prev, m]));
    return () => s.disconnect();
  }, [room, user?.name]);

  return (
    <div className="live-chat-shell fullheight-section">
      <div className="live-chat-top">
        <h3>Live Chat</h3>
      </div>

      <div className="chat-body no-scrollbar">
        {msgs.map((m, i) => {
          const mine = m.from === user?.name;
          return (
            <div
              key={i}
              className={`chat-msg ${mine ? "user" : "bot"}`}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "70%",
              }}
            >
              {m.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}

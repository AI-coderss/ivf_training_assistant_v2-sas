import React, {
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext,
} from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import io from "socket.io-client";
import ChatInputWidget from "../components/ChatInputWidget";
import "../styles/Quizzes/QuizzesPage.css";

// ===== Context =====
const QuizCtx = createContext(null);
const useQuiz = () => useContext(QuizCtx);

// ===== Helpers =====
const fmtPct = (num) => (Number.isFinite(num) ? Math.round(num * 100) : 0);
const nowIso = () => new Date().toISOString();
const skillToBand = (s = 0) => (s < 1200 ? "Starter" : s < 1500 ? "Medium" : "Difficult");
const skillToLevel = (s = 0) => (s < 1200 ? 1 : s < 1350 ? 2 : s < 1500 ? 3 : s < 1650 ? 4 : 5);

export default function QuizzesPage() {
  const [active, setActive] = useState("quizzes"); // quizzes | feedback | leaderboard | dashboard | live
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [lastAttempts, setLastAttempts] = useState([]); // [{q_id, topic, type, correct, ts}]
  const [totals, setTotals] = useState({ correct: 0, incorrect: 0 });
  const [toast, setToast] = useState(null);

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
    }),
    [active, session, user, selectedTopic, lastAttempts, totals]
  );

  return (
    <QuizCtx.Provider value={ctx}>
      <div className="qp-wrap">
        <Header />
        <TabBar active={active} setActive={setActive} />
        <div className="qp-body">
          {active === "quizzes" && <QuizzesTab />}
          {active === "feedback" && <FeedbackTab />}
          {active === "leaderboard" && <LeaderboardTab />}
          {active === "dashboard" && <DashboardTab />}
          {active === "live" && <LiveChatTab />}
        </div>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </div>
    </QuizCtx.Provider>
  );
}

// ===== UI: Header / Tabs / Toast =====
function Header() {
  const { session, user } = useQuiz();
  return (
    <div className="qp-header">
      <h2 className="qp-title">Adaptive Quizzes Platform</h2>
      <div className="header-right">
        <BadgePill label={`XP ${session?.xp ?? 0}`} />
        <BadgePill label={`Streak ${session?.streak ?? 0}`} />
        <BadgePill label={`Level ${skillToLevel(session?.skill)}`} />
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
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setActive(t.id)}
          className={`tab ${active === t.id ? "active" : ""}`}
          title={t.label}
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
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return <div className="toast">{message}</div>;
}

// ===================================================
// QUIZZES TAB
// ===================================================
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

  // Ensure user
  useEffect(() => {
    if (!user) {
      const name =
        localStorage.getItem("qp_name") || `User_${Math.floor(Math.random() * 9999)}`;
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

  // Timer
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTimeout(() => setCooldown(false), 1400);

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
      if (data.events?.includes("level_up")) setToast("Level up! Moving to Medium.");
      if (data.events?.includes("level_up2"))
        setToast("Great work! Moving to Difficult.");
      if (data.events?.includes("streak"))
        setToast(`🔥 Streak x${data.session.streak}!`);
      if (data.next_available) {
        await nextQuestion();
      } else {
        setToast("You’re done for now — see Feedback tab.");
      }
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
    setToast("Session finalized. Check AI Feedback & Dashboard.");
    setActive("feedback");
  };

  return (
    <div className="quizzes-tab">
      {!session ? (
        <button disabled={loading} onClick={startSession} className="btn">
          {loading ? "Starting…" : "Start Session"}
        </button>
      ) : (
        <>
          <div className="quiz-topbar">
            <BadgePill label={`Difficulty: ${question?.difficulty ?? skillToBand(session?.skill)}`} />
            <BadgePill label={`Timer: ${Math.max(0, timeLeft)}s`} />
            <BadgePill label={`Topic: ${question?.topic ?? "-"}`} />
            <button className="btn ghost" onClick={finalize}>Finish</button>
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
                    <label key={idx} className={`opt ${selected === idx ? "sel" : ""}`}>
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
                <button className="btn" onClick={() => handleSubmit(false)} disabled={selected === null}>
                  Submit
                </button>
                <button className="btn ghost" onClick={requestHint}>Hint (-XP)</button>
                <button className="btn ghost" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
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
        </>
      )}
    </div>
  );
}

// ===================================================
// FEEDBACK TAB  (Charts + Coach chat with docked input)
// ===================================================
function FeedbackTab() {
  const { session, selectedTopic, setSelectedTopic, lastAttempts, totals, setToast } = useQuiz();
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! I’m your AI Coach. Ask me for tips on any topic." , ts: nowIso()},
  ]);

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

  const topicPieConfig = useMemo(() => {
    const data = Object.entries(byTopic).map(([topic, v]) => ({
      name: topic,
      y: v.total ? v.correct / v.total : 0,
      events: { click: () => setSelectedTopic(topic) },
    }));
    return {
      chart: { type: "pie" },
      title: { text: "Topic Mastery" },
      tooltip: { pointFormat: "<b>{point.percentage:.1f}%</b> mastery" },
      series: [{ name: "Mastery", data }],
    };
  }, [byTopic, setSelectedTopic]);

  const ratioPieConfig = {
    chart: { type: "pie" },
    title: { text: "Correct vs Incorrect" },
    series: [
      { name: "Attempts", data: [{ name: "Correct", y: correct }, { name: "Incorrect", y: incorrect }] },
    ],
  };

  // ChatInputWidget handler
  const onCoachSend = async (payload) => {
    if (payload?.text?.trim()) {
      const text = selectedTopic ? `${payload.text}\n\n(Focus: ${selectedTopic})` : payload.text;
      setMessages((m) => [...m, { role: "user", text, ts: nowIso() }]);
      const r = await fetch("/api/feedback/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session?.session_id,
          message: payload.text,
          topic_filter: selectedTopic,
        }),
      });
      const data = await r.json();
      setMessages((m) => [...m, { role: "ai", text: data.reply, ts: nowIso() }]);
      setToast("Coach replied.");
    } else if (payload?.audioFile) {
      setMessages((m) => [...m, { role: "user", text: "🎤 Voice message sent.", ts: nowIso() }]);
    }
  };

  const filtered = selectedTopic ? lastAttempts.filter((a) => a.topic === selectedTopic) : lastAttempts;

  return (
    <div className="feedback-layout">
      <div className="feedback-left">
        <div className="chart-card"><HighchartsReact highcharts={Highcharts} options={ratioPieConfig} /></div>
        <div className="chart-card"><HighchartsReact highcharts={Highcharts} options={topicPieConfig} /></div>
        {selectedTopic && (
          <button className="btn ghost mt8" onClick={() => setSelectedTopic(null)}>
            Clear topic filter
          </button>
        )}
      </div>

      <div className="coach-panel">
        <div className="coach-header">
          <h3>AI Coach</h3>
          <span className="coach-sub">{selectedTopic ? `Focused on: ${selectedTopic}` : "Ask anything about your performance"}</span>
        </div>

        <div className="chat-log bubbles">
          {messages.map((m, i) => (
            <div key={i} className={`bubble-row ${m.role === "user" ? "right" : "left"}`}>
              <div className={`bubble ${m.role === "user" ? "me" : "ai"}`}>
                <div className="bubble-text">{m.text}</div>
                <div className="bubble-time">{new Date(m.ts).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}

          <div className="attempts-head">Recent Attempts {selectedTopic ? `• ${selectedTopic}` : ""}</div>
          <ul className="attempts">
            {filtered.slice(-14).reverse().map((a, idx) => (
              <li key={idx} className={a.correct ? "ok" : "bad"}>
                <span className="attempt-time">{new Date(a.ts).toLocaleTimeString()}</span>
                <strong className="attempt-topic">[{a.topic}]</strong> {a.type} — {a.correct ? "✅ Correct" : "❌ Incorrect"}
              </li>
            ))}
          </ul>
        </div>

        {/* Docked chat input */}
        <div className="chat-dock">
          <ChatInputWidget onSendMessage={onCoachSend} />
        </div>
      </div>
    </div>
  );
}

// ===================================================
// LEADERBOARD TAB
// ===================================================
function LeaderboardTab() {
  const [period, setPeriod] = useState("daily");
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);

  const fetchLB = async (p = period) => {
    const r = await fetch(`/api/leaderboard?period=${p}`);
    const data = await r.json();
    setRows(data.rows);
    setMe(data.me || null);
  };
  useEffect(() => {
    fetchLB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <div className="leaderboard">
      <div className="lb-filters">
        {["daily", "weekly", "all_time"].map((p) => (
          <button key={p} className={`btn ${period === p ? "" : "ghost"}`} onClick={() => setPeriod(p)}>
            {p}
          </button>
        ))}
      </div>

      <table className="table">
        <thead>
          <tr><th>#</th><th>User</th><th>XP</th><th>Streak</th><th>Level</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.user_id} className={me?.user_id === r.user_id ? "me" : ""}>
              <td>{i + 1}</td>
              <td>{r.name}</td>
              <td>{r.xp}</td>
              <td>{r.streak}</td>
              <td>{skillToLevel(r.skill)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {me && (
        <div className="me-card">
          <strong>Your Rank:</strong> #{me.rank} • XP {me.xp} • Streak {me.streak} • Level {skillToLevel(me.skill)}
        </div>
      )}
    </div>
  );
}

// ===================================================
// DASHBOARD TAB (more diverse cards/charts)
// ===================================================
function DashboardTab() {
  const { totals, lastAttempts, setSelectedTopic, session } = useQuiz();
  const [series, setSeries] = useState([]);
  const [typeData, setTypeData] = useState([]);
  const [topicBars, setTopicBars] = useState([]);

  // Progress line
  useEffect(() => {
    const byDay = {};
    lastAttempts.forEach((a) => {
      const d = new Date(a.ts).toISOString().slice(0, 10);
      if (!byDay[d]) byDay[d] = { correct: 0, total: 0 };
      byDay[d].total += 1;
      if (a.correct) byDay[d].correct += 1;
    });
    const days = Object.keys(byDay).sort();
    setSeries([
      {
        name: "Accuracy",
        data: days.map((d) => [
          Date.parse(d),
          byDay[d].total ? byDay[d].correct / byDay[d].total : 0,
        ]),
      },
    ]);
  }, [lastAttempts]);

  // Types bar
  useEffect(() => {
    const m = {};
    lastAttempts.forEach((a) => (m[a.type] = (m[a.type] || 0) + 1));
    const data = Object.entries(m).map(([name, y]) => ({ name, y }));
    setTypeData(data);
  }, [lastAttempts]);

  // Topic attempts (top 8)
  useEffect(() => {
    const m = {};
    lastAttempts.forEach((a) => (m[a.topic] = (m[a.topic] || 0) + 1));
    const top = Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    setTopicBars(top.map(([name, y]) => ({ name, y })));
  }, [lastAttempts]);

  const lineCfg = {
    chart: { type: "line", zoomType: "x" },
    title: { text: "Progress Over Time" },
    xAxis: { type: "datetime" },
    yAxis: {
      min: 0,
      max: 1,
      labels: { formatter() { return `${fmtPct(this.value)}%`; } },
    },
    tooltip: { pointFormat: "<b>{point.y:.2f}</b> accuracy" },
    series,
  };

  const typesCfg = {
    chart: { type: "column" },
    title: { text: "Question Type Mix" },
    xAxis: { type: "category" },
    series: [{ name: "Items", data: typeData }],
  };

  const topicsCfg = {
    chart: { type: "bar" },
    title: { text: "Attempts by Topic (Top 8)" },
    xAxis: {
      type: "category",
      labels: { style: { fontSize: "11px" } },
    },
    series: [
      {
        name: "Attempts",
        data: topicBars.map((d) => ({
          name: d.name,
          y: d.y,
          events: { click: () => setSelectedTopic(d.name) },
        })),
      },
    ],
  };

  return (
    <div className="dashboard-grid">
      <div className="kpis">
        <div className="kpi">
          <span>Total Attempts</span>
          <strong>{(totals.correct || 0) + (totals.incorrect || 0)}</strong>
        </div>
        <div className="kpi">
          <span>Accuracy</span>
          <strong>
            {fmtPct(
              (totals.correct || 0) /
                Math.max(1, (totals.correct || 0) + (totals.incorrect || 0))
            )}
            %
          </strong>
        </div>
        <div className="kpi">
          <span>Level</span>
          <strong>{skillToLevel(session?.skill || 0)}</strong>
        </div>
      </div>

      <div className="chart-card"><HighchartsReact highcharts={Highcharts} options={lineCfg} /></div>
      <div className="chart-card"><HighchartsReact highcharts={Highcharts} options={typesCfg} /></div>
      <div className="chart-card wide"><HighchartsReact highcharts={Highcharts} options={topicsCfg} /></div>

      <p className="tiny-note">Tip: Click a topic bar to filter the Feedback tab.</p>
    </div>
  );
}

// ===================================================
// LIVE CHAT TAB (Socket.IO) with bottom dock input
// ===================================================
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
    s.on("challenge", (m) =>
      setMsgs((prev) => [
        ...prev,
        { system: true, text: `⚔️ ${m.from} challenged ${m.to}!`, ts: nowIso() },
      ])
    );
    return () => {
      s.disconnect();
    };
  }, [room, user?.name]);

  const sendMsg = (payload) => {
    if (payload?.text?.trim()) {
      const data = { room, from: user?.name, text: payload.text, ts: nowIso() };
      socket.emit("message", data);
      setMsgs((m) => [...m, data]);
    } else if (payload?.audioFile) {
      const data = { room, from: user?.name, text: "🎤 Voice message sent.", ts: nowIso() };
      socket.emit("message", data);
      setMsgs((m) => [...m, data]);
    }
  };

  const challenge = () => {
    socket.emit("challenge", { room, from: user?.name, to: "Anyone", ts: nowIso() });
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>Live Chat</h3>
        <button className="btn ghost" onClick={challenge}>⚔️ Challenge</button>
      </div>

      <div className="chat-log bubbles">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`bubble-row ${
              m.system ? "center" : m.from === user?.name ? "right" : "left"
            }`}
          >
            <div className={`bubble ${m.system ? "system" : m.from === user?.name ? "me" : "ai"}`}>
              <div className="bubble-meta">
                {m.system ? "System" : m.from} • {new Date(m.ts || Date.now()).toLocaleTimeString()}
              </div>
              <div className="bubble-text">{m.text}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-dock">
        <ChatInputWidget onSendMessage={sendMsg} />
      </div>
    </div>
  );
}

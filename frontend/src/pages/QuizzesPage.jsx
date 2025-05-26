import React, { useState } from "react";
import "../styles/QuizzesPage.css";

const QuizzesPage = () => {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState("");
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // 🆕 loading state

  const startQuiz = async () => {
    setError("");
    setLoading(true); // show loader
    try {
      const res = await fetch("https://ivf-backend-server.onrender.com/start-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "IVF" }),
      });

      if (!res.ok) throw new Error("Server error: " + res.statusText);

      const data = await res.json();
      console.log("✅ Received quiz data:", data);

      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error("Invalid quiz data format received from server.");
      }

      setQuestions(data.questions);
      setQuizStarted(true);
    } catch (err) {
      console.error("❌ Failed to fetch quiz:", err);
      setError("Failed to load quiz. Please try again.");
    } finally {
      setLoading(false); // hide loader
    }
  };

  const handleSubmit = () => {
    const correct = questions[current].correct;
    if (selected === correct) setScore(score + 1);

    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      setSelected("");
    } else {
      setShowResult(true);
    }
  };

  const restart = () => {
    setCurrent(0);
    setScore(0);
    setSelected("");
    setQuizStarted(false);
    setShowResult(false);
    setQuestions([]);
    setError("");
  };

  return (
    <div className="quiz-container">
      <h2>IVF Knowledge Quizzes 🧠</h2>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <div className="loading-box">
          <div className="spinner"></div>
          <p>Generating your quiz… please wait ⏳</p>
        </div>
      ) : !quizStarted ? (
        <button className="start-button" onClick={startQuiz}>
          Start Quiz
        </button>
      ) : showResult ? (
        <div className="result-box">
          <h3>Quiz Completed 🎉</h3>
          <p>
            You scored {score} out of {questions.length}
          </p>
          <button className="restart-button" onClick={restart}>
            Try Again
          </button>
        </div>
      ) : (
        <div className="question-box">
          <h3>
            Question {current + 1} of {questions.length}
          </h3>
          <p className="question-text">{questions[current].text}</p>
          <ul className="options-list">
            {questions[current].options.map((option, idx) => (
              <li key={idx}>
                <label className="option-label">
                  <input
                    type="radio"
                    name={`question-${current}`}
                    value={option}
                    checked={selected === option}
                    onChange={() => setSelected(option)}
                  />
                  {option}
                </label>
              </li>
            ))}
          </ul>
          <button
            className="next-button"
            onClick={handleSubmit}
            disabled={!selected}
          >
            {current + 1 === questions.length ? "Submit" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizzesPage;





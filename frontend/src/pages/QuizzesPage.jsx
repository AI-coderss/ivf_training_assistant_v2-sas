import React, { useState } from "react";
import "../styles/QuizzesPage.css";

const QuizzesPage = () => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const startQuiz = async () => {
    setError("");
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, selectedOption) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: selectedOption,
    }));
  };

  const submitQuiz = () => {
    let score = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correct) {
        score++;
      }
    });
    setScore(score);
    setShowResult(true);
  };

  const restart = () => {
    setAnswers({});
    setScore(0);
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
        <form className="all-questions-form" onSubmit={(e) => { e.preventDefault(); submitQuiz(); }}>
          {questions.map((q, index) => (
            <div key={q.id} className="question-block">
              <h4>
                {index + 1}. {q.text}
              </h4>
              <ul className="options-list">
                {q.options.map((option, idx) => (
                  <li key={idx}>
                    <label className="option-label">
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        value={option}
                        checked={answers[q.id] === option}
                        onChange={() => handleAnswer(q.id, option)}
                      />
                      {option}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <button type="submit" className="submit-button" disabled={Object.keys(answers).length < questions.length}>
            Submit Quiz
          </button>
        </form>
      )}
    </div>
  );
};

export default QuizzesPage;






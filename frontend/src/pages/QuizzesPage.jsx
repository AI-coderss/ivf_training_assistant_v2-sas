// File: components/Quizzes/QuizzesPage.jsx
import React, { useState, useEffect } from "react";
import "../styles/QuizzesPage.css";
import TimerDisplay from "../components/Quizzes/TimerDisplay";
import QuestionBlock from "../components/Quizzes/QuestionBlock";
import ResultSummary from "../components/Quizzes/ResultSummary";

const QuizzesPage = () => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [feedbackShown, setFeedbackShown] = useState({});
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [timerActive, setTimerActive] = useState(false);

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
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error("Invalid quiz data format received from server.");
      }

      setQuestions(data.questions);
      setQuizStarted(true);
      setTimeLeft(600);
      setTimerActive(true);
    } catch (err) {
      setError("Failed to load quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, selectedOption) => {
    if (feedbackShown[questionId]) return;
    setAnswers((prev) => ({ ...prev, [questionId]: selectedOption }));
    setFeedbackShown((prev) => ({ ...prev, [questionId]: true }));
  };

  const submitQuiz = () => {
    let updatedAnswers = { ...answers };
    let updatedFeedback = {};
    let score = 0;

    questions.forEach((q) => {
      if (!(q.id in updatedAnswers)) {
        updatedAnswers[q.id] = null;
      }
      updatedFeedback[q.id] = true;
      if (updatedAnswers[q.id] === q.correct) score++;
    });

    setAnswers(updatedAnswers);
    setFeedbackShown(updatedFeedback);
    setScore(score);
    setShowResult(true);
    setTimerActive(false);
  };

  const getPassStatus = () => {
    const percentage = (score / questions.length) * 100;
    return percentage >= 50 ? "pass" : "fail";
  };

  const restart = () => {
    setAnswers({});
    setScore(0);
    setQuizStarted(false);
    setShowResult(false);
    setQuestions([]);
    setFeedbackShown({});
    setError("");
    setTimeLeft(600);
    setTimerActive(false);
  };

  useEffect(() => {
    let interval;
    if (quizStarted && !showResult && timerActive) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            submitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizStarted, showResult, timerActive]);

  return (
    <div className="quiz-container">
      <h2>IVF Knowledge Quizzes 🧐</h2>
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
        <>
          <ResultSummary score={score} total={questions.length} getPassStatus={getPassStatus} />
          <button className="restart-button" onClick={restart}>Try Again</button>
        </>
      ) : (
        <div className="quiz-with-timer">
          <TimerDisplay timeLeft={timeLeft} />
          <form
            className="all-questions-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitQuiz();
            }}
          >
            {questions.map((q, index) => (
              <QuestionBlock
                key={q.id}
                question={q}
                index={index}
                selected={answers[q.id]}
                showFeedback={feedbackShown[q.id]}
                handleAnswer={handleAnswer}
              />
            ))}
            <button
              type="submit"
              className="submit-button"
              disabled={Object.keys(answers).length < questions.length}
            >
              Submit Quiz
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default QuizzesPage;


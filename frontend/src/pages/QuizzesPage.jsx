import React, { useState, useEffect } from "react";
import "../styles/QuizzesPage.css";

const QuizzesPage = () => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [feedbackShown, setFeedbackShown] = useState({});
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [timerActive, setTimerActive] = useState(false);

  const startQuiz = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        "https://ivf-backend-server.onrender.com/start-quiz",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "IVF" }),
        }
      );

      if (!res.ok) throw new Error("Server error: " + res.statusText);

      const data = await res.json();
      console.log("✅ Received quiz data:", data);

      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error("Invalid quiz data format received from server.");
      }

      setQuestions(data.questions);
      setQuizStarted(true);
      setTimeLeft(600); // Reset timer
      setTimerActive(true);
    } catch (err) {
      console.error("❌ Failed to fetch quiz:", err);
      setError("Failed to load quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, selectedOption) => {
    if (feedbackShown[questionId]) return;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: selectedOption,
    }));

    setFeedbackShown((prev) => ({
      ...prev,
      [questionId]: true,
    }));
  };

  const submitQuiz = () => {
    let updatedAnswers = { ...answers };
    let updatedFeedback = {};
    let score = 0;

    questions.forEach((q) => {
      // If question wasn't answered, mark as null
      if (!(q.id in updatedAnswers)) {
        updatedAnswers[q.id] = null;
      }

      updatedFeedback[q.id] = true;

      if (updatedAnswers[q.id] === q.correct) {
        score++;
      }
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
          <p className={getPassStatus() === "pass" ? "pass-text" : "fail-text"}>
            {getPassStatus() === "pass" ? "✅ You Passed!" : "❌ You Failed."}
          </p>
          <button className="restart-button" onClick={restart}>
            Try Again
          </button>
        </div>
      ) : (
        <div className="quiz-with-timer">
          <div className="timer-display">
            ⏱{" "}
            {Math.floor(timeLeft / 60)
              .toString()
              .padStart(2, "0")}
            :{(timeLeft % 60).toString().padStart(2, "0")}
          </div>

          <form
            className="all-questions-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitQuiz();
            }}
          >
            {questions.map((q, index) => {
              const selected = answers[q.id];
              const isCorrect = selected === q.correct;
              const showFeedback = feedbackShown[q.id];

              return (
                <div key={q.id} className="question-block">
                  <h4>
                    {index + 1}. {q.text}
                  </h4>
                  <ul className="options-list">
                    {q.options.map((option, idx) => {
                      let optionClass = "option-label";
                      let feedbackIcon = null;

                      if (showFeedback) {
                        if (option === selected && selected === q.correct) {
                          optionClass += " correct";
                          feedbackIcon = "✅";
                        } else if (
                          option === selected &&
                          selected !== q.correct
                        ) {
                          optionClass += " incorrect";
                          feedbackIcon = "❌";
                        } else if (option === q.correct) {
                          optionClass += " correct";
                        }
                      }

                      return (
                        <li key={idx}>
                          <label className={optionClass}>
                            <input
                              type="radio"
                              name={`question-${q.id}`}
                              value={option}
                              disabled={showFeedback}
                              checked={selected === option}
                              onChange={() => handleAnswer(q.id, option)}
                            />
                            {option}{" "}
                            {feedbackIcon && (
                              <span className="feedback-icon">
                                {feedbackIcon}
                              </span>
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  {showFeedback && (
                    <div className="feedback-text">
                      {isCorrect
                        ? "Correct ✅"
                        : `Incorrect ❌. Correct answer: ${q.correct}`}
                    </div>
                  )}
                </div>
              );
            })}

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

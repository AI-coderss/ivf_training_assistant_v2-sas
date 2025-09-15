/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "../../styles/Quizzes/quizzes.css";
import TimerDisplay from "../Quizzes/TimerDisplay";
import QuestionBlock from "../Quizzes/QuestionBlock";
import ResultSummary from "../Quizzes/ResultSummary";
import Badge from "../Quizzes/Badge";
import ChatBot from "../Quizzes/Chatbot";

/**
 * NOTE:
 * - All original logic kept.
 * - Added single-question pagination (idx) for a clean view.
 * - Added draggable header + close toggle (calls optional onClose()).
 */
const TrueFalseQuiz = ({ quizData, questionType = "TrueFalse", onClose }) => {
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
  const [showChatbot, setShowChatbot] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState("");
  const [predefinedQuestions, setPredefinedQuestions] = useState([]);

  // UI: single-question pagination
  const [idx, setIdx] = useState(0);

  const [previousPerformance, setPreviousPerformance] = useState(() => {
    const stored = localStorage.getItem("trueFalsePerformance");
    return stored ? JSON.parse(stored) : { easy: { correct: 0, total: 0 } };
  });

  const startQuiz = async () => {
    setQuestions(
      (quizData || []).map((q, index) => ({
        id: index + 1,
        text: q.question,
        options: ["True", "False"],
        correct: q.correctAnswer,
        difficulty: "easy",
      }))
    );
    setQuizStarted(true);
    setTimeLeft(600);
    setTimerActive(true);
    setIdx(0);
  };

  const handleAnswer = (questionId, selectedOption) => {
    if (feedbackShown[questionId]) return;
    setAnswers((prev) => ({ ...prev, [questionId]: selectedOption }));
    setFeedbackShown((prev) => ({ ...prev, [questionId]: true }));
  };

  const submitQuiz = () => {
    let updatedAnswers = { ...answers };
    let updatedFeedback = {};
    let s = 0;
    let newPerformance = { ...previousPerformance };

    const wrong = questions.filter((q) => updatedAnswers[q.id] !== q.correct);

    if (wrong.length >= 3) {
      setShowChatbot(true);
      const feedbackText = `
The trainee made mistakes in the following questions:

${wrong
  .map(
    (q) =>
      `Q: ${q.text}
Answered: ${updatedAnswers[q.id] || "No answer"}
Correct: ${q.correct}`
  )
  .join("\n\n")}

Please offer feedback on:
- Key misconceptions
- Suggested readings or review points
- Motivation for the learner
      `.trim();

      setFeedbackPrompt(feedbackText);

      const predefined = [
        "What can I improve from this quiz?",
        ...wrong.map(
          (q) => `Why is "${q.correct}" the correct answer to: "${q.text}"?`
        ),
      ];
      setPredefinedQuestions(predefined);
    }

    questions.forEach((q) => {
      const isCorrect = updatedAnswers[q.id] === q.correct;
      const level = q.difficulty || "easy";

      if (!(q.id in updatedAnswers)) updatedAnswers[q.id] = null;
      updatedFeedback[q.id] = true;

      if (!newPerformance[level])
        newPerformance[level] = { correct: 0, total: 0 };
      newPerformance[level].total += 1;
      if (isCorrect) newPerformance[level].correct += 1;
      if (isCorrect) s++;
    });

    setAnswers(updatedAnswers);
    setFeedbackShown(updatedFeedback);
    setScore(s);
    setPreviousPerformance(newPerformance);
    localStorage.setItem(
      "trueFalsePerformance",
      JSON.stringify(newPerformance)
    );
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
    setShowChatbot(false);
    setFeedbackPrompt("");
    setPredefinedQuestions([]);
    setIdx(0);
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
  }, [quizStarted, showResult, timerActive]);

  const total = questions.length || 1;
  const q = questions[idx] || {};
  const canPrev = idx > 0;
  const canNext = idx < total - 1;
  const canSubmit = Object.keys(answers).length === total;

  return (
    <div className="quiz-overlay-root" aria-hidden={false}>
      <motion.div
        className="quiz-float-card"
        drag
        dragMomentum={false}
        dragElastic={0.12}
        whileDrag={{ scale: 1.01 }}
      >
        <header className="quiz-drag-header" aria-label="Drag to move">
          <div className="quiz-brand">
            <span className="quiz-logo" aria-hidden>▸</span>
            <span>IVF Program Quiz</span>
          </div>
          <div className="quiz-header-right">
            <span className="quiz-timer"><TimerDisplay timeLeft={timeLeft} /></span>
            {typeof onClose === "function" && (
              <button className="quiz-close" onClick={onClose} aria-label="Close quiz">×</button>
            )}
          </div>
        </header>

        <main className="quiz-body">
          {/* Progress like screenshot: index-based */}
          <div className="quiz-progress">
            <div className="quiz-progress-row">
              <span className="quiz-progress-label">Progress</span>
              <span className="quiz-progress-count">{Math.min(idx + 1, total)}/{total}</span>
            </div>
            <div
              className="quiz-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(((idx + 1) / total) * 100)}
            >
              <div
                className="quiz-progress-fill"
                style={{ width: `${Math.round(((idx + 1) / total) * 100)}%` }}
              />
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          {!quizStarted ? (
            <button className="btn-primary start-button" onClick={startQuiz}>
              Start Quiz
            </button>
          ) : showResult ? (
            <>
              <ResultSummary
                score={score}
                total={questions.length}
                getPassStatus={getPassStatus}
              />
              {(score / questions.length) * 100 >= 80 && <Badge />}
              {showChatbot && (
                <ChatBot
                  open={true}
                  initialMessage={feedbackPrompt}
                  predefinedQuestions={predefinedQuestions}
                />
              )}
              <button className="btn-primary restart-button" onClick={restart}>
                Try Again
              </button>
            </>
          ) : (
            <>
              <h2 className="quiz-question">
                {q.text || "—"}
              </h2>

              {q.id && (
                <QuestionBlock
                  question={q}
                  index={idx}
                  selected={answers[q.id]}
                  correct={q.correct}
                  showFeedback={feedbackShown[q.id]}
                  handleAnswer={handleAnswer}
                />
              )}

              <div className="quiz-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIdx((v) => Math.max(0, v - 1))}
                  disabled={!canPrev}
                >
                  Previous
                </button>

                {canNext ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setIdx((v) => Math.min(total - 1, v + 1))}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={submitQuiz}
                    disabled={!canSubmit}
                  >
                    Submit
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </motion.div>
    </div>
  );
};

export default TrueFalseQuiz;



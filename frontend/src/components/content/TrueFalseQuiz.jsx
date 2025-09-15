/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import "../../styles/Quizzes/quizzes.css";
import TimerDisplay from "../Quizzes/TimerDisplay";
import QuestionBlock from "../Quizzes/QuestionBlock";
import ResultSummary from "../Quizzes/ResultSummary";
import Badge from "../Quizzes/Badge";
import ChatBot from "../Quizzes/Chatbot";

const TrueFalseQuiz = ({ quizData, questionType = "TrueFalse" }) => {
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

  // purely-for-UI navigation (scroll only; does NOT affect scoring logic)
  const [navIndex, setNavIndex] = useState(0);
  const qRefs = useRef([]);

  const [previousPerformance, setPreviousPerformance] = useState(() => {
    const stored = localStorage.getItem("trueFalsePerformance");
    return stored ? JSON.parse(stored) : { easy: { correct: 0, total: 0 } };
  });

  const startQuiz = async () => {
    setQuestions(
      quizData.map((q, index) => ({
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
    setNavIndex(0);
    qRefs.current = [];
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
- Motivation for the learner`.trim();

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
    setNavIndex(0);
    qRefs.current = [];
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

  // UI-only progress (answered/total)
  const answeredCount = Object.keys(answers).length;
  const total = questions.length || 1;
  const progressPct = Math.round((answeredCount / total) * 100);

  const scrollToIndex = (i) => {
    const el = qRefs.current[i];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setNavIndex(i);
  };
  const canPrev = navIndex > 0;
  const canNext = navIndex < (questions.length ? questions.length - 1 : 0);

  return (
    <div className="quiz-stage">
      {/* Top bar */}
      <header className="quiz-topbar">
        <div className="quiz-brand">
          <span className="quiz-logo" aria-hidden>
            ▸
          </span>
          <span>IVF Program Quiz</span>
        </div>
        <div className="quiz-topbar-right">
          <span className="quiz-timer">
            <TimerDisplay timeLeft={timeLeft} />
          </span>
        </div>
      </header>

      <main className="quiz-main">
        <section className="quiz-card">
          {/* Progress header */}
          <div className="quiz-progress">
            <div className="quiz-progress-row">
              <span className="quiz-progress-label">Progress</span>
              <span className="quiz-progress-count">
                {answeredCount}/{total}
              </span>
            </div>
            <div
              className="quiz-progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPct}
            >
              <div
                className="quiz-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="quiz-header-line">
            <h2 className="quiz-title">True / False Quiz 🔍</h2>
          </div>

          {error && <p className="error-text">{error}</p>}

          {loading ? (
            <div className="loading-box">
              <div className="spinner"></div>
              <p>Preparing quiz…</p>
            </div>
          ) : !quizStarted ? (
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
              <p className="performance-summary">
                Accuracy:{" "}
                {Math.round(
                  (previousPerformance.easy.correct /
                    (previousPerformance.easy.total || 1)) *
                  100
                )}
                %
              </p>
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
            <div className="quiz-with-timer">
              <form
                className="all-questions-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitQuiz();
                }}
              >
                {questions.map((q, index) => (
                  <div
                    key={q.id}
                    id={`q-${index + 1}`}
                    className="question-scroll-anchor"
                    ref={(el) => (qRefs.current[index] = el)}
                  >
                    <QuestionBlock
                      question={q}
                      index={index}
                      selected={answers[q.id]}
                      correct={q.correct}
                      showFeedback={feedbackShown[q.id]}
                      handleAnswer={handleAnswer}
                    />
                  </div>
                ))}

                {/* Sticky nav & submit — purely UI; does not alter quiz logic */}
                <div className="quiz-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => scrollToIndex(Math.max(0, navIndex - 1))}
                    disabled={!canPrev}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      scrollToIndex(
                        Math.min(questions.length - 1, navIndex + 1)
                      )
                    }
                    disabled={!canNext}
                  >
                    Next
                  </button>

                  <button
                    type="submit"
                    className="btn-primary submit-button"
                    disabled={Object.keys(answers).length < questions.length}
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default TrueFalseQuiz;

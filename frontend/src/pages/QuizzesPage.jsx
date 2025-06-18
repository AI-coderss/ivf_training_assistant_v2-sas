import React, { useState, useEffect } from "react";
import "../styles/Quizzes/QuizzesPage.css";
import TimerDisplay from "../components/Quizzes/TimerDisplay";
import QuestionBlock from "../components/Quizzes/QuestionBlock";
import ResultSummary from "../components/Quizzes/ResultSummary";
import Badge from "../components/Quizzes/Badge";
import ChatBot from "../components/Quizzes/Chatbot";
import StreamingQuestion from "../components/Quizzes/StreamingQuestion"; // ✅ new!
import useLiveQuiz from "../hooks/useLiveQuiz"; // ✅ the hook

const QuizzesPage = () => {
  const {
    questions,
    error,
    startQuiz,
    streamingQuestion,
    setQuestions,
    setError,
  } = useLiveQuiz();

  const [answers, setAnswers] = useState({});
  const [feedbackShown, setFeedbackShown] = useState({});
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600);
  const [timerActive, setTimerActive] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState("");
  const [predefinedQuestions, setPredefinedQuestions] = useState([]);

  const [previousPerformance, setPreviousPerformance] = useState(() => {
    const stored = localStorage.getItem("quizPerformance");
    return stored
      ? JSON.parse(stored)
      : {
          easy: { correct: 0, total: 0 },
          medium: { correct: 0, total: 0 },
          hard: { correct: 0, total: 0 },
        };
  });

  const chooseDifficulty = () => {
    const { easy, medium } = previousPerformance;
    const easyAccuracy = easy.total > 0 ? easy.correct / easy.total : 0;
    const mediumAccuracy = medium.total > 0 ? medium.correct / medium.total : 0;
    if (easyAccuracy >= 0.7 && mediumAccuracy >= 0.7) return "hard";
    if (easyAccuracy >= 0.7) return "medium";
    return "easy";
  };

  const handleStartQuiz = async () => {
    setAnswers({});
    setScore(0);
    setShowResult(false);
    setFeedbackShown({});
    setError("");
    setShowChatbot(false);
    setFeedbackPrompt("");
    setPredefinedQuestions([]);
    setTimeLeft(600);

    const difficulty = chooseDifficulty();
    await startQuiz(difficulty);

    setQuizStarted(true);
    setTimerActive(true);
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
    let newPerformance = { ...previousPerformance };

    const wrong = questions.filter((q) => updatedAnswers[q.id] !== q.correct);

    if (wrong.length >= 5) {
      setShowChatbot(true);
      const feedbackText = `
The trainee made mistakes in the following IVF questions:

${wrong
  .map(
    (q) =>
      `Q: ${q.text}
Answered: ${updatedAnswers[q.id] || "No answer"}
Correct: ${q.correct}`
  )
  .join("\n\n")}

Based on these mistakes, please provide:
- A short summary of weak areas
- Suggested topics to review
- Encouragement to help improve
      `.trim();

      setFeedbackPrompt(feedbackText);

      const predefined = [
        "Given my performance, what concepts should I focus on?",
        ...wrong.map((q) => `Why was my answer to "${q.text}" incorrect?`),
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
      if (isCorrect) score++;
    });

    setAnswers(updatedAnswers);
    setFeedbackShown(updatedFeedback);
    setScore(score);
    setPreviousPerformance(newPerformance);
    localStorage.setItem("quizPerformance", JSON.stringify(newPerformance));
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

      {!quizStarted ? (
        <button className="start-button" onClick={handleStartQuiz}>
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
            Accuracy: Easy{" "}
            {Math.round(
              (previousPerformance.easy.correct /
                (previousPerformance.easy.total || 1)) *
                100
            )}
            %, Medium{" "}
            {Math.round(
              (previousPerformance.medium.correct /
                (previousPerformance.medium.total || 1)) *
                100
            )}
            %, Hard{" "}
            {Math.round(
              (previousPerformance.hard.correct /
                (previousPerformance.hard.total || 1)) *
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
          <button className="restart-button" onClick={restart}>
            Try Again
          </button>
        </>
      ) : (
        <>
          <div className="sticky-timer-wrapper">
            <TimerDisplay timeLeft={timeLeft} />
          </div>

          <div className="quiz-with-timer">
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
                  correct={q.correct}
                  showFeedback={feedbackShown[q.id]}
                  handleAnswer={handleAnswer}
                />
              ))}

              {/* ✅ Live typing block */}
              {streamingQuestion && (
                <StreamingQuestion text={streamingQuestion} />
              )}

              <button
                type="submit"
                className="submit-button"
                disabled={Object.keys(answers).length < questions.length}
              >
                Submit Quiz
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default QuizzesPage;

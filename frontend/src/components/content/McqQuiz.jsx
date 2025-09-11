/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import "../../styles/Quizzes/QuizzesPage.css";
import TimerDisplay from "../Quizzes/TimerDisplay";
import QuestionBlock from "../Quizzes/QuestionBlock";
import ResultSummary from "../Quizzes/ResultSummary";
import Badge from "../Quizzes/Badge";
import ChatBot from "../Quizzes/Chatbot";

const McqQuiz = ({ quizData, questionType = "MCQ", referenceText }) => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [feedbackShown, setFeedbackShown] = useState({});
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(900); // 15 min for MCQ
  const [timerActive, setTimerActive] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState("");
  const [predefinedQuestions, setPredefinedQuestions] = useState([]);

  const [previousPerformance, setPreviousPerformance] = useState(() => {
    const stored = localStorage.getItem("mcqPerformance");
    return stored ? JSON.parse(stored) : { medium: { correct: 0, total: 0 } };
  });

  const startQuiz = async () => {
    setQuestions(
      quizData.map((q, index) => ({
        id: index + 1,
        text: q.question,
        options: q.options,
        correct: q.correctAnswer,
        difficulty: q.difficulty || "medium",
      }))
    );
    setQuizStarted(true);
    setTimeLeft(900);
    setTimerActive(true);
  };

  // const startQuiz = async () => {
  //   setError("");
  //   setLoading(true);

  //   try {
  //     await new Promise((resolve) => setTimeout(resolve, 500));

  //     const processedQuestions = quizData.map((q, index) => ({
  //       id: index + 1,
  //       text: q.question,
  //       options: q.options, // MCQ options
  //       correct: q.correctAnswer,
  //       difficulty: q.difficulty || "medium",
  //     }));

  //     setQuestions(processedQuestions);
  //     setQuizStarted(true);
  //     setTimeLeft(900);
  //     setTimerActive(true);
  //   } catch (err) {
  //     console.error("Quiz loading error:", err);
  //     setError("Failed to load quiz.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

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

    if (wrong.length >= 3) {
      setShowChatbot(true);
      const feedbackText = `
      Refrence text for questions:${referenceText}
The trainee made mistakes in the following MCQs:

${wrong
  .map(
    (q) => `Q: ${q.text}
Answered: ${updatedAnswers[q.id] || "No answer"}
Correct: ${q.correct}`
  )
  .join("\n\n")}

Please provide:
- Explanation of correct answers
- Recommended references
- Encouragement for improvement
      `.trim();

      setFeedbackPrompt(feedbackText);

      const predefined = [
        "Which topics should I revise?",
        ...wrong.map((q) => `Why is "${q.correct}" correct for: "${q.text}"?`),
      ];
      setPredefinedQuestions(predefined);
    }

    questions.forEach((q) => {
      const isCorrect = updatedAnswers[q.id] === q.correct;
      const level = q.difficulty || "medium";

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
    localStorage.setItem("mcqPerformance", JSON.stringify(newPerformance));
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
    setTimeLeft(900);
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
  }, [quizStarted, showResult, timerActive]);

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <TimerDisplay timeLeft={timeLeft} />
        <h2>Multiple Choice Quiz 📝</h2>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <div className="loading-box">
          <div className="spinner"></div>
          <p>Preparing MCQs…</p>
        </div>
      ) : !quizStarted ? (
        <button className="start-button" onClick={startQuiz}>
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
              (previousPerformance.medium.correct /
                (previousPerformance.medium.total || 1)) *
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

export default McqQuiz;
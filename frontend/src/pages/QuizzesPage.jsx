import React, { useState, useEffect } from "react";
import "../styles/Quizzes/QuizzesPage.css";
import TimerDisplay from "../components/Quizzes/TimerDisplay";
import QuestionBlock from "../components/Quizzes/QuestionBlock";
import ResultSummary from "../components/Quizzes/ResultSummary";
import Badge from "../components/Quizzes/Badge";
import ChatBot from "../components/Quizzes/Chatbot";

const levels = ["basic", "medium", "advanced"]; // Define available levels

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
  const [showChatbot, setShowChatbot] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState("");
  const [predefinedQuestions, setPredefinedQuestions] = useState([]);

  const [previousPerformance, setPreviousPerformance] = useState(() => {
    const stored = localStorage.getItem("quizPerformance");
    return stored
      ? JSON.parse(stored)
      : {
          basic: { correct: 0, total: 0 },
          medium: { correct: 0, total: 0 },
          advanced: { correct: 0, total: 0 },
        };
  });

  const [currentLevel, setCurrentLevel] = useState(() => {
    const savedLevel = localStorage.getItem("currentQuizLevel");
    if (savedLevel && levels.includes(savedLevel)) {
      return savedLevel;
    }
    // Optional: Determine initial level based on past performance if no saved level
    // For now, defaulting to 'basic' if nothing is saved.
    // const { basic, medium } = previousPerformance; // Ensure previousPerformance is initialized first
    // const basicAccuracy = basic.total > 0 ? basic.correct / basic.total : 0;
    // const mediumAccuracy = medium.total > 0 ? medium.correct / medium.total : 0;
    // if (basicAccuracy >= 0.8 && mediumAccuracy >= 0.8) return "advanced";
    // if (basicAccuracy >= 0.8) return "medium";
    return "basic";
  });

  useEffect(() => {
    localStorage.setItem("currentQuizLevel", currentLevel);
  }, [currentLevel]);

  useEffect(() => {
    localStorage.setItem(
      "quizPerformance",
      JSON.stringify(previousPerformance)
    );
  }, [previousPerformance]);

  const startQuiz = async () => {
    setError("");
    setLoading(true);
    // const difficulty = chooseDifficulty(); // Old logic, now using currentLevel
    const difficulty = currentLevel;

    try {
      const res = await fetch(
        "https://ivf-backend-server.onrender.com/start-quiz",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: "IVF", difficulty }), // Send currentLevel as difficulty
        }
      );

      if (!res.ok) throw new Error("Server error: " + res.statusText);
      const data = await res.json();
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error("Invalid quiz data format received from server.");
      }

      const letterMap = { A: 0, B: 1, C: 2, D: 3 };
      const processedQuestions = data.questions.map((q) => {
        // Ensure q.correct is a string before trimming and converting to uppercase
        const correctKey =
          typeof q.correct === "string" ? q.correct.trim().toUpperCase() : "";
        const correctIndex = letterMap[correctKey];
        return {
          ...q,
          // Ensure q.options is an array and correctIndex is valid
          correct:
            Array.isArray(q.options) &&
            correctIndex !== undefined &&
            q.options[correctIndex] !== undefined
              ? q.options[correctIndex]
              : "", // Default to empty string or handle error if necessary
        };
      });

      setQuestions(processedQuestions);
      setQuizStarted(true);
      setShowResult(false); // Ensure results are hidden when new quiz starts
      setAnswers({}); // Reset answers for new quiz
      setFeedbackShown({}); // Reset feedback for new quiz
      setScore(0); // Reset score for new quiz
      setTimeLeft(600);
      setTimerActive(true);
    } catch (err) {
      console.error("Quiz fetch error:", err);
      setError("Failed to load quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, selectedOption) => {
    if (feedbackShown[questionId] && showResult) return; // Allow changing answers if quiz not submitted
    setAnswers((prev) => ({ ...prev, [questionId]: selectedOption }));
    // setFeedbackShown((prev) => ({ ...prev, [questionId]: true })); // Show feedback immediately - kept from original
  };

  const submitQuiz = () => {
    let updatedAnswers = { ...answers };
    let updatedFeedback = {};
    let calculatedScore = 0; // Use a local variable for score calculation
    let newPerformance = JSON.parse(JSON.stringify(previousPerformance)); // Deep copy

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
      // const questionActualDifficulty = q.difficulty || currentLevel; // Fallback to currentLevel if q.difficulty is missing

      if (!(q.id in updatedAnswers)) updatedAnswers[q.id] = null;
      updatedFeedback[q.id] = true; // Show feedback for all questions after submission

      // Ensure the level exists in newPerformance
      if (!newPerformance[currentLevel]) {
        newPerformance[currentLevel] = { correct: 0, total: 0 };
      }
      newPerformance[currentLevel].total += 1;
      if (isCorrect) {
        newPerformance[currentLevel].correct += 1;
        calculatedScore++;
      }
    });

    setAnswers(updatedAnswers);
    setFeedbackShown(updatedFeedback); // Show all feedback now
    setScore(calculatedScore);
    setPreviousPerformance(newPerformance);
    // localStorage.setItem("quizPerformance", JSON.stringify(newPerformance)); // Moved to useEffect
    setShowResult(true);
    setTimerActive(false);
  };

  const getPassStatus = () => {
    if (questions.length === 0) return "fail"; // Avoid division by zero
    const percentage = (score / questions.length) * 100;
    return percentage >= 50 ? "pass" : "fail"; // Original pass threshold
  };

  const restart = () => {
    // setAnswers({}); // Moved to startQuiz
    // setScore(0); // Moved to startQuiz
    setQuizStarted(false);
    setShowResult(false);
    setQuestions([]);
    // setFeedbackShown({}); // Moved to startQuiz
    setError("");
    setTimeLeft(600);
    setTimerActive(false);
    setShowChatbot(false);
    setFeedbackPrompt("");
    setPredefinedQuestions([]);
    // currentLevel remains the same, user will "Try Again" at the current level
    // or proceed to next if they choose to.
  };

  const handleProceedToNextLevel = () => {
    const currentLevelIndex = levels.indexOf(currentLevel);
    if (currentLevelIndex < levels.length - 1) {
      const nextLevelName = levels[currentLevelIndex + 1];
      setCurrentLevel(nextLevelName);
      restart(); // Reset UI, user will click "Start Quiz" for the new level
      // startQuiz will then use the updated currentLevel
    }
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
  }, [quizStarted, showResult, timerActive]); // submitQuiz was removed from deps as it might cause loops if not stable

  const canProceed = (score / (questions.length || 1)) * 100 >= 80;
  const currentLevelIndex = levels.indexOf(currentLevel);
  const hasNextLevel = currentLevelIndex < levels.length - 1;

  return (
    <div className="quiz-container">
      <h2>
        IVF Knowledge Quizzes 🧐 (Current Level:{" "}
        {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)})
      </h2>
      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <div className="loading-box">
          <div className="spinner"></div>
          <p>Generating your quiz… please wait ⏳</p>
        </div>
      ) : !quizStarted ? (
        <button className="start-button" onClick={startQuiz}>
          Start {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)}{" "}
          Quiz
        </button>
      ) : showResult ? (
        <>
          <ResultSummary
            score={score}
            total={questions.length}
            getPassStatus={getPassStatus}
          />
          {canProceed && <Badge />}
          <p className="performance-summary">
            Overall Accuracy: Basic{" "}
            {Math.round(
              (previousPerformance.basic.correct /
                (previousPerformance.basic.total || 1)) *
                100
            )}
            %, Medium{" "}
            {Math.round(
              (previousPerformance.medium.correct /
                (previousPerformance.medium.total || 1)) *
                100
            )}
            %, Advanced{" "}
            {Math.round(
              (previousPerformance.advanced.correct /
                (previousPerformance.advanced.total || 1)) *
                100
            )}
            %
          </p>
          {canProceed && hasNextLevel && (
            <button
              className="proceed-button"
              onClick={handleProceedToNextLevel}
            >
              Proceed to{" "}
              {levels[currentLevelIndex + 1].charAt(0).toUpperCase() +
                levels[currentLevelIndex + 1].slice(1)}{" "}
              Level 🚀
            </button>
          )}
          {showChatbot && (
            <ChatBot
              open={true}
              initialMessage={feedbackPrompt}
              predefinedQuestions={predefinedQuestions}
            />
          )}
          <button className="restart-button" onClick={restart}>
            Try {currentLevel.charAt(0).toUpperCase() + currentLevel.slice(1)}{" "}
            Again
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
                  key={q.id || `q-${index}`} // Add fallback key if id is missing
                  question={q}
                  index={index}
                  selected={answers[q.id]}
                  correctAnswer={q.correct} // Renamed prop for clarity in QuestionBlock if needed
                  showFeedback={feedbackShown[q.id]}
                  handleAnswer={handleAnswer}
                />
              ))}
              <button
                type="submit"
                className="submit-button"
                disabled={Object.keys(answers).length === 0} // Allow submitting even if not all answered (original was < questions.length)
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

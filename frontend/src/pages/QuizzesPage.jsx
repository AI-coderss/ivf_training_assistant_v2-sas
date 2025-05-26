import React, { useState } from "react";
import Quiz from "react-quiz-component";
import "../styles/QuizzesPage.css";

const QuizzesPage = () => {
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);

  const startQuiz = async () => {
    setLoading(true);
    try {
      const res = await fetch("https://ivfvirtualtrainingassistantdsah.onrender.com/start-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "IVF" }),
      });

      const data = await res.json();

      const formattedQuiz = {
        quizTitle: "🧠 IVF Knowledge Quiz",
        questions: data.questions.map((q) => ({
          question: q.text,
          questionType: "text",
          answerSelectionType: "single",
          answers: q.options,
          correctAnswer: String(q.options.indexOf(q.correct) + 1),
          messageForCorrectAnswer: "✅ Correct!",
          messageForIncorrectAnswer: "❌ Incorrect. Try again.",
          explanation: q.explanation || "",
          point: "1",
        })),
      };

      setQuizData(formattedQuiz);
      setQuizStarted(true);
    } catch (error) {
      console.error("Failed to fetch quiz:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quiz-container">
      <h2>IVF Knowledge Quizzes 🧠</h2>

      {!quizStarted && (
        <button className="start-button" onClick={startQuiz} disabled={loading}>
          {loading ? "Loading..." : "Start Quiz"}
        </button>
      )}

      {quizStarted && quizData && (
        <Quiz
          quiz={quizData}
          shuffle={true}
          showInstantFeedback={true}
          continueTillCorrect={false}
          onComplete={(result) => console.log("Quiz Finished:", result)}
        />
      )}
    </div>
  );
};

export default QuizzesPage;



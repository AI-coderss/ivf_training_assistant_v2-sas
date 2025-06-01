import React from "react";
import "../../styles/Quizzes/QuizzesPage.css";

const ResultSummary = ({ score, total }) => {
  const percentage = (score / total) * 100;
  const passed = percentage >= 50;

  return (
    <div className="result-box">
      <h3>Quiz Completed 🎉</h3>
      <p>You scored {score} out of {total}</p>
      <p className={passed ? "pass-text" : "fail-text"}>
        {passed ? "✅ You Passed!" : "❌ You Failed."}
      </p>
    </div>
  );
};

export default ResultSummary;

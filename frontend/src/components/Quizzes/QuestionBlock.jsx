import React from "react";
import "../../styles/QuizzesPage.css";

const QuestionBlock = ({ question, index, selected, correct, showFeedback, handleAnswer }) => {
  return (
    <div className="question-block">
      <h4>
        {index + 1}. {question.text}
      </h4>
      <ul className="options-list">
        {question.options.map((option, idx) => {
          let optionClass = "option-label";
          let feedbackIcon = null;

          const isUserAnswer = selected === option;
          const isCorrectAnswer = correct === option;

          if (showFeedback) {
            if (isCorrectAnswer) {
              optionClass += " correct";
              if (isUserAnswer) feedbackIcon = "✅";
            } else if (isUserAnswer) {
              optionClass += " incorrect";
              feedbackIcon = "❌";
            }
          }

          return (
            <li key={idx}>
              <label className={optionClass}>
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={option}
                  disabled={showFeedback}
                  checked={isUserAnswer}
                  onChange={() => handleAnswer(question.id, option)}
                />
                {option}
                {feedbackIcon && (
                  <span className="feedback-icon">{feedbackIcon}</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      {showFeedback && (
        <div className="feedback-text">
          {selected === correct
            ? "Correct ✅"
            : `Incorrect ❌. Correct answer: ${correct}`}
        </div>
      )}
    </div>
  );
};

export default QuestionBlock;




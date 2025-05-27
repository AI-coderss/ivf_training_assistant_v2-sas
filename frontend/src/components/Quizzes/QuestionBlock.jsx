import React from "react";
import "../../styles/QuizzesPage.css";

const QuestionBlock = ({ question, index, selected, showFeedback, handleAnswer }) => {
  const isCorrect = selected === question.correct;

  return (
    <div className="question-block">
      <h4>
        {index + 1}. {question.text}
      </h4>
      <ul className="options-list">
        {question.options.map((option, idx) => {
          let optionClass = "option-label";
          let feedbackIcon = null;

          if (showFeedback) {
            if (option === selected && selected === question.correct) {
              optionClass += " correct";
              feedbackIcon = "✅";
            } else if (option === selected && selected !== question.correct) {
              optionClass += " incorrect";
              feedbackIcon = "❌";
            } else if (option === question.correct) {
              optionClass += " correct";
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
                  checked={selected === option}
                  onChange={() => handleAnswer(question.id, option)}
                />
                {option}
                {feedbackIcon && (
                  <span className="feedback-icon"> {feedbackIcon}</span>
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
            : `Incorrect ❌. Correct answer: ${question.correct}`}
        </div>
      )}
    </div>
  );
};

export default QuestionBlock;


import React from "react";

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

          if (showFeedback) {
            const isUserAnswer = option === selected;
            const isCorrectAnswer = option === correct;

            if (isUserAnswer && isCorrectAnswer) {
              optionClass += " correct";
              feedbackIcon = "✅";
            } else if (isUserAnswer && !isCorrectAnswer) {
              optionClass += " incorrect";
              feedbackIcon = "❌";
            }

            if (!isUserAnswer && isCorrectAnswer) {
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
                {feedbackIcon && <span className="feedback-icon">{feedbackIcon}</span>}
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



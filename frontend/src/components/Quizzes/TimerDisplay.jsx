import React from "react";
import "../../styles/QuizzesPage.css";

const TimerDisplay = ({ timeLeft }) => {
  const minutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  return (
    <div className="timer-display">
      ⏱ {minutes}:{seconds}
    </div>
  );
};

export default TimerDisplay;

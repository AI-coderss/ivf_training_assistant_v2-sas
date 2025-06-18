import React, { useState, useEffect } from "react";
import "../../styles/Quizzes/QuizzesPage.css";

const StreamingQuestion = ({ text }) => {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    if (!text) return;
    let index = 0;
    const interval = setInterval(() => {
      setVisibleText(text.slice(0, index + 1));
      index++;
      if (index >= text.length) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="streaming-question">
      <h4>{visibleText}</h4>
    </div>
  );
};

export default StreamingQuestion;


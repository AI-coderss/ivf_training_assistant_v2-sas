import React, { useState, useEffect } from "react";

const StreamingQuestion = ({ text }) => {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    if (!text) return;
    let index = 0;
    const interval = setInterval(() => {
      setVisibleText(text.slice(0, index + 1));
      index++;
      if (index >= text.length) clearInterval(interval);
    }, 15); // Typing speed
    return () => clearInterval(interval);
  }, [text]);

  return (
    <div className="streaming-question">
      <p>{visibleText}</p>
    </div>
  );
};

export default StreamingQuestion;

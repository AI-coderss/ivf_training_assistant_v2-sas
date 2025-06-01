import React, { useEffect, useState } from "react";
import "../../styles/Quizzes/QuizzesPage.css";

const Leaderboard = () => {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("quizLeaderboard");
    if (stored) {
      const parsed = JSON.parse(stored);
      const sorted = parsed.sort((a, b) => b.percentage - a.percentage);
      setEntries(sorted.slice(0, 5));
    }
  }, []);

  return (
    <div className="leaderboard-box">
      <h3>🏆 Leaderboard</h3>
      {entries.length === 0 ? (
        <p>No scores yet. Take the quiz to get started!</p>
      ) : (
        <ol className="leaderboard-list">
          {entries.map((entry, idx) => (
            <li key={idx}>
              <strong>{entry.name}</strong>: {entry.score}/{entry.total} (
              {Math.round(entry.percentage)}%)
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default Leaderboard;

import React, { useState } from "react";
import MusicPlayer from "../components/Summary/MusicPlayer";
import ChatWithBook from "../components/Summary/ChatWithBook";
import "../styles/Summary/SummariesPage.css";

const SummariesPage = () => {
  const [selectedBook, setSelectedBook] = useState(null);

  return (
    <div className="sp-summary-page">
      <h2>📚 Quick Summaries</h2>
      <div className="sp-two-column-layout">
        <div className="sp-left-column">
          <MusicPlayer />
        </div>
        <div className="sp-right-column">
          <div className="sp-chat">
            <ChatWithBook book={selectedBook} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummariesPage;




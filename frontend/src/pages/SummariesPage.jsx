import React, { useState } from "react";
import SummaryBookShelf from "../components/Summary/SummaryBookShelf";
import ChatWithBook from "../components/Summary/ChatWithBook";
import PodcastPlayer from "../components/Summary/PodcastPlayer";

import "../styles/Summary/SummariesPage.css";

const SummariesPage = () => {
  const [selectedBook, setSelectedBook] = useState(null);

  return (
    <div className="summary-page">
      <h2>📚 Quick Summaries</h2>

      <div className="summary-sections">
        <div className="section bookshelf-section">
          <SummaryBookShelf
            onSelectBook={(book) => setSelectedBook(book)}
            selectedBookUrl={selectedBook?.pdfUrl}
          />
        </div>

        <div className="section chat-section">
          <ChatWithBook book={selectedBook} />
        </div>

        <div className="section podcast-section">
          <PodcastPlayer book={selectedBook} />
        </div>
      </div>
    </div>
  );
};

export default SummariesPage;



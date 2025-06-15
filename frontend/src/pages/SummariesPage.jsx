// src/pages/SummariesPage.jsx
import React, { useState } from "react";
import SummaryBookShelf from "../components/Summary/SummaryBookShelf";
import ChatWithBook from "../components/Summary/ChatWithBook";


import "../styles/Summary/SummariesPage.css";

const SummariesPage = () => {
  const [selectedBook, setSelectedBook] = useState(null);

  return (
    <div className="sp-summary-page">
      <h2>📚 Quick Summaries</h2>

      {/* ⬇️ new class --> sp-layout  */}
      <div className="sp-layout">
        <div className="sp-bookshelf">
          <SummaryBookShelf
            onSelectBook={(book) => setSelectedBook(book)}
            selectedBookUrl={selectedBook?.pdfUrl}
          />
        </div>

        <div className="sp-chat">
          <ChatWithBook book={selectedBook} />
        </div>
      </div>
    </div>
  );
};

export default SummariesPage;




import React from "react";
import "../../styles/BookViewer.css";

const BookViewer = ({ selectedBookUrl }) => {
  return (
    <div className="book-viewer">
      <iframe
        title="Flipbook Viewer"
        allowFullScreen
        scrolling="no"
        className="flipbook-frame"
        src={selectedBookUrl}
      ></iframe>
    </div>
  );
};

export default BookViewer;









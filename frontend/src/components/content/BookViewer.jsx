import React from 'react';
import PdfFlipBook from '../PdfFlipBook';

const BookViewer = ({ selectedBookUrl, onOCRText, isAssistantOpen }) => {
  return (
    <div className="book-viewer" style={{ width: '100%', maxWidth: 900, margin: '0 auto' }}>
      <PdfFlipBook pdfUrl={selectedBookUrl} width={800} onOCRText={onOCRText} isAssistantOpen={isAssistantOpen} />
    </div>
  );
};

export default BookViewer;

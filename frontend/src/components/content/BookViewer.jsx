import React, {  useRef } from "react";
import PdfFlipBook from "../PdfFlipBook";
import BookTTSReader from "./BookTTSReader";
import useBookStore from "../../store/bookStore";

const BookViewer = ({ selectedBookUrl, onOCRText, isAssistantOpen }) => {

  const { chunks, bookText, isReaderMode } = useBookStore();

  const isMobile = window.innerWidth <= 1024;

  const containerRef = useRef(null);
  // console.log("selectedChunkIndex", selectedChunkIndex);
  // console.log("selectedCunk", chunks[selectedChunkIndex]);
  // 📖 Load entire book text on first load
  // useEffect(() => {
  //   if (!selectedBookUrl) return;

  //   const absoluteUrl = selectedBookUrl.startsWith("http")
  //     ? selectedBookUrl
  //     : `${window.location.origin}${selectedBookUrl}`;

  //   const fetchBookText = async () => {
  //     try {
  //       const res = await fetch("http://127.0.0.1:5001/extract-pdf-text", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({ pdfUrl: absoluteUrl }),
  //       });
  //       const data = await res.json();
  //       if (data.text) {
  //         setBookText(data.text);
  //       }
  //     } catch (err) {
  //       console.error("Error extracting PDF text:", err);
  //     }
  //   };

  //   fetchBookText();
  // }, [selectedBookUrl]);



  return (
    <div>
      <div style={{ maxWidth: 900, margin: "0 auto", height: "80vh" }} >
        <PdfFlipBook
          pdfUrl={selectedBookUrl}
          width={800}
          onOCRText={onOCRText}
          isAssistantOpen={isAssistantOpen}
          containerRef={containerRef}
        />
      </div>
      {bookText && (isReaderMode || isMobile) && (
        <BookTTSReader
          chunks={chunks}
          text={bookText}
          onAutoFlip={(chunkIndex) => {
            if ((chunkIndex + 1) % 2 === 0) {
              console.log("📄 Flip page here!");
            }
          }}
          containerRef={containerRef}

        />
      )}
    </div>
  );
};

export default BookViewer;
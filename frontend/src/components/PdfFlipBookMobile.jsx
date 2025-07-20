import React, { useState, useRef, useEffect } from "react";
import { Document, Page as PdfPage, pdfjs } from "react-pdf";
import html2canvas from "html2canvas";
import SelectionBox from "./SelectionBox";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "../styles/PdfFlipBook.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function PdfFlipBookMobile({ pdfUrl, width, onOCRText, isAssistantOpen }) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isOCRMode, setIsOCRMode] = useState(false);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [selectedBox, setSelectedBox] = useState(null);
  const containerRef = useRef(null);

  const playClickSound = () => {
    const sound = new Audio("/page-flip.mp3");
    sound.play().catch((e) => {
      console.warn("Audio play failed:", e);
    });
  };

  useEffect(() => {
    if (isAssistantOpen) {
      setIsOCRMode(false);
      setSelectedBox(null);
    }
  }, [isAssistantOpen]);

  const handleRectangleComplete = async (box) => {
    const container = containerRef.current;
    if (!container) return;

    setLoadingOCR(true);
    setSelectedBox(box);

    try {
      const canvas = await html2canvas(container, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });

      const scaleX = canvas.width / container.clientWidth;
      const scaleY = canvas.height / container.clientHeight;

      const sx = box.x * scaleX;
      const sy = box.y * scaleY;
      const sw = box.w * scaleX;
      const sh = box.h * scaleY;

      const cropped = document.createElement("canvas");
      cropped.width = sw;
      cropped.height = sh;
      const ctx = cropped.getContext("2d");
      ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

      cropped.toBlob(async (blob) => {
        if (!blob) {
          setLoadingOCR(false);
          return;
        }

        const formData = new FormData();
        formData.append("image", blob);

        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/ocr`, {
          method: "POST",
          body: formData,
        });

        const result = await res.json();
        setLoadingOCR(false);
        if (onOCRText) {
          onOCRText(result.text || "No text detected");
        }
      }, "image/png");
    } catch (err) {
      alert("Something went wrong while capturing the selection.");
      setLoadingOCR(false);
    }
  };

  return (
    <div className="mobile-pdf-viewer">
      <div className="toolbar" style={{ marginBottom: 10 }}>
        {!isAssistantOpen && (
          <button className="select-text-btn" onClick={() => setIsOCRMode(true)}>
            Select Text
          </button>
        )}
      </div>

      <div ref={containerRef} style={{ position: "relative" }}>
        <Document
          file={pdfUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<p>Loading…</p>}
        >
          <PdfPage
            pageNumber={currentPage}
            width={width}
            renderTextLayer
            renderAnnotationLayer={false}
          />
        </Document>

        {isOCRMode && (
          <SelectionBox containerRef={containerRef} onBoxReady={handleRectangleComplete} />
        )}

        {selectedBox && (
          <div
            className="highlight-rectangle"
            style={{
              left: selectedBox.x,
              top: selectedBox.y,
              width: selectedBox.w,
              height: selectedBox.h,
            }}
          />
        )}

        {loadingOCR && (
          <div className="ocr-loader-overlay">
            <div className="ocr-loader">
              <p>Reading text...</p>
              <div className="spinner" />
            </div>
          </div>
        )}

        {!isAssistantOpen && (
          <div className="pdf-nav-buttons">
            <button
              onClick={() => {
                if (currentPage > 1) {
                  playClickSound();
                  setCurrentPage(p => Math.max(p - 1, 1));
                }
              }}
              disabled={currentPage <= 1}
            >
              ◀ Prev
            </button>
            <span style={{ color: "#fff", fontSize: "14px" }}>
              {currentPage} / {numPages}
            </span>
            <button
              onClick={() => {
                if (currentPage < numPages) {
                  playClickSound();
                  setCurrentPage(p => Math.min(p + 1, numPages));
                }
              }}
              disabled={currentPage >= numPages}
            >
              Next ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

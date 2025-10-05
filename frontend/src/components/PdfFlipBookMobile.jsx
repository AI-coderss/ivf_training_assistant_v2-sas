/* eslint-disable no-unused-vars */
/* eslint-disable no-loop-func */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { Document, Page as PdfPage, pdfjs } from "react-pdf";
import html2canvas from "html2canvas";
import SelectionBox from "./SelectionBox";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "../styles/PdfFlipBook.css";
import useBookStore from "../store/bookStore";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export default function PdfFlipBookMobile({
  pdfUrl,
  width,
  onOCRText,
  isAssistantOpen,
  containerRef,
}) {
  const [numPages, setNumPages] = useState(null);
  const [isOCRMode, setIsOCRMode] = useState(false);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [selectedBox, setSelectedBox] = useState(null);
  const [pageRanges, setPageRanges] = useState([]);
  const {
    chunks,
    setSelectedTextInfo,
    isAutoScrolling,
    selectedChunkIndex,
    setBookText,
    currentPage,
    setCurrentPage,
  } = useBookStore();
  const selectedTextInfo = useBookStore((state) => state.selectedTextInfo);
  const goToPage = useBookStore((state) => state.goToPage);
  const setGoToPage = useBookStore((state) => state.setGoToPage);

  console.log(
    "Mobile Viewer - selectedChunkIndex:",
    selectedChunkIndex,
    " | currentPage:",
    currentPage
  );
  useEffect(() => {
    if (!numPages) return;

    const buildPageRanges = async () => {
      const pdf = await pdfjs.getDocument(pdfUrl).promise;
      let ranges = [];
      const fullTextArr = [];
      let globalIndex = 0;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((it) => it.str).join("");
        fullTextArr.push(pageText);
        const startIndex = globalIndex;
        const endIndex = globalIndex + pageText.length - 1;

        ranges.push({ pageNumber: i, startIndex, endIndex });
        globalIndex = endIndex + 1;
      }
      setBookText(fullTextArr.join(" "));
      setPageRanges(ranges);
    };

    buildPageRanges();
  }, [numPages, pdfUrl]);

  useEffect(() => {
    if (!goToPage || !containerRef?.current) return;

    const pageElement = containerRef.current.querySelector(
      `.react-pdf__Page[data-page-number="${goToPage}"]`
    );

    if (pageElement) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
      setGoToPage(null); // reset after scrolling
    }
  }, [goToPage, containerRef]);

  const playClickSound = () => {
    const sound = new Audio("/page-flip.mp3");
    sound.volume = 0.01; // Set volume to 1%
    sound.play().catch((e) => {
      console.warn("Audio play failed:", e);
    });
  };

  useEffect(() => {
    if (!numPages || !pageRanges.length || selectedChunkIndex == null) return;

    const chunk = chunks[selectedChunkIndex];
    if (!chunk) return;

    console.log("Selected Chunk :", chunk);

    const pagesRange = pageRanges.filter(
      (r) => r.endIndex >= chunk.startIndex && r.startIndex <= chunk.endIndex
    );
    if (!pagesRange.length) return;

    const firstPageNum = pagesRange[0].pageNumber;
    setCurrentPage(firstPageNum);

    // 🔹 Clear ALL highlights from all pages first
    const allPages = containerRef.current?.querySelectorAll(
      ".react-pdf__Page__textContent span"
    );
    allPages?.forEach((span) => {
      if (span.dataset.originalText) {
        span.innerHTML = span.dataset.originalText;
        span.style.fontSize = "60%";

        // Add these styles to enable text wrapping
        span.style.whiteSpace = "normal";
        span.style.wordWrap = "break-word";
        span.style.overflowWrap = "break-word";
        span.style.display = "inline-block";
        span.style.maxWidth = "100%"; // Ensure it doesn't exceed container width
      }
    });

    // 🔹 Then apply highlights only on the required pages
    pagesRange.forEach((pageRange) => {
      const pageElement = containerRef.current?.querySelector(
        `.react-pdf__Page[data-page-number="${pageRange.pageNumber}"]`
      );
      if (!pageElement) return;

      const spans = pageElement.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );

      let charIndex = pageRange.startIndex;

      spans.forEach((span) => {
        const text = span.textContent;
        const length = text.length;

        if (!span.dataset.originalText) {
          span.dataset.originalText = text;
        }

        const spanStart = charIndex;
        const spanEnd = charIndex + length - 1;

        const overlapStart = Math.max(spanStart, chunk.startIndex);
        const overlapEnd = Math.min(spanEnd, chunk.endIndex);

        if (overlapStart <= overlapEnd) {
          if (!document.getElementById(`chunk-${selectedChunkIndex}-start`)) {
            span.innerHTML = `<mark id="chunk-${selectedChunkIndex}-start" style="background-color: blue; color: white;">${text}</mark>`;
            if (isAutoScrolling) {
              span.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          } else {
            span.innerHTML = `<mark style="background-color: blue; color: white;">${text}</mark>`;
            if (isAutoScrolling) {
              span.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }
        }
        charIndex += length;
      });
    });
  }, [selectedChunkIndex, pageRanges, chunks, numPages, selectedTextInfo]);

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

  // Handle text selection
  const handleTextSelection = () => {
    if (!numPages) return; // <--- guard until PDF is loaded
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    if (!selectedText) return;

    // Find the closest .react-pdf__Page containing the selection
    // Ensure selectedNode is an element
    let selectedNode = range.commonAncestorContainer;
    if (selectedNode.nodeType !== 1) {
      // If it's a text node, use its parent element
      selectedNode = selectedNode.parentElement;
    }
    const pageElement = selectedNode.closest(".react-pdf__Page");
    if (!pageElement) return;

    // Get the page number from the data-page-number attribute
    const pageNumber = parseInt(
      pageElement.getAttribute("data-page-number"),
      10
    );
    if (!pageNumber) return;
    console.log(pageNumber, "page number", numPages);
    // Calculate the cumulative character index up to the selected page
    let charIndex = 0;
    const allPages = containerRef.current.querySelectorAll(".react-pdf__Page");
    for (let i = 1; i <= numPages; i++) {
      if (i < pageNumber) {
        // Sum the text lengths of all previous pages
        const prevPage = containerRef.current.querySelector(
          `.react-pdf__Page[data-page-number="${i}"]`
        );
        const prevTextLayer = prevPage?.querySelector(
          ".react-pdf__Page__textContent"
        );
        if (prevTextLayer) {
          const prevSpans = prevTextLayer.querySelectorAll("span");
          prevSpans.forEach((span) => {
            charIndex += span.textContent.length;
          });
        }
      } else if (i === pageNumber) {
        // Process the current page's text layer
        console.log("processing current page text");
        const textLayer = pageElement.querySelector(
          ".react-pdf__Page__textContent"
        );
        if (textLayer) {
          const spans = textLayer.querySelectorAll("span");
          let found = false;
          spans.forEach((span) => {
            // console.log(span.textContent, selectedText, range.intersectsNode(span));
            if (!found && range.intersectsNode(span)) {
              // Get the start and end offsets within the span
              const startContainer = range.startContainer;
              const isSpanTextNode =
                startContainer.nodeType === Node.TEXT_NODE &&
                startContainer.parentNode === span;
              const startOffset = isSpanTextNode ? range.startOffset : 0;
              // Calculate start and end indices
              const startIndex = charIndex + startOffset;
              const endIndex = startIndex + selectedText.length - 1;

              setSelectedTextInfo({
                text: selectedText,
                pageNumber: pageNumber,
                startIndex: startIndex,
                endIndex: endIndex,
                itemIndex: startOffset,
              });
              found = true;
              // console.log("Text Selection Info:", {
              //     text: selectedText,
              //     pageNumber: pageNumber,
              //     startIndex: startIndex,
              //     endIndex: endIndex,
              // })
            }
            charIndex += span.textContent.length;
          });
        }
        break; // No need to process further pages
      }
    }

    // console.log("Selected Text:", selectedText);
    // console.log("Page Number:", pageNumber);
  };

  // Add event listener for text selection
  useEffect(() => {
    if (!numPages) return;

    const listener = () => handleTextSelection();
    document.addEventListener("selectionchange", listener);
    return () => {
      document.removeEventListener("selectionchange", listener);
    };
  }, [numPages]);

  return (
    <div className="mobile-pdf-viewer">
      <div className="toolbar" style={{ marginBottom: 10 }}>
        {!isAssistantOpen && (
          <>
            {/* <button
              className="ocr-toggle-button"
              onClick={() => {
                setIsOCRMode(false);
                setIsReaderMode(!isReaderMode);
              }}
              style={{ backgroundColor: isReaderMode ? "#0056b3" : "white", color: isReaderMode ? "white" : "black" }}
            >
              {isReaderMode ? "Exit Reader" : "Immersive Reader"}
            </button> */}
            <button
              className={"ocr-toggle-button"}
              onClick={() => {
                setIsOCRMode(!isOCRMode);
              }}
              style={{
                backgroundColor: isOCRMode ? "#0056b3" : "white",
                color: isOCRMode ? "white" : "black",
              }}
            >
              Select Text
            </button>
          </>
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
          <SelectionBox
            containerRef={containerRef}
            onBoxReady={handleRectangleComplete}
          />
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
                  setCurrentPage(Math.max(currentPage - 1, 1));
                }
              }}
              disabled={currentPage <= 1}
            >
              ◀ Prev
            </button>
            <span style={{ color: "#000", fontSize: "14px", margin: "0 11px" }}>
              {currentPage} / {numPages}
            </span>
            <button
              onClick={() => {
                if (currentPage < numPages) {
                  playClickSound();
                  setCurrentPage(Math.min(currentPage + 1, numPages));
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
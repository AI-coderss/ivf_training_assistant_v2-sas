import React, { useState, useRef, forwardRef, useEffect } from "react";
import HTMLFlipBook from "react-pageflip";
import { Document, Page as PdfPage, pdfjs } from "react-pdf";
import html2canvas from "html2canvas";
import SelectionBox from "./SelectionBox";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "../styles/PdfFlipBook.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const FlipPage = forwardRef(function FlipPageInner({ pageNumber, width }, ref) {
    return (
        <div ref={ref} className="flip-page" style={{ position: "relative" }}>
            <PdfPage
                pageNumber={pageNumber}
                width={width}
                renderTextLayer
                renderAnnotationLayer={false}
            />
        </div>
    );
});

export default function PdfFlipBookDesktop({ pdfUrl, width = 800, onOCRText, isAssistantOpen }) {
    const [numPages, setNumPages] = useState(null);
    const [isOCRMode, setIsOCRMode] = useState(false);
    const [loadingOCR, setLoadingOCR] = useState(false);
    const [selectedBox, setSelectedBox] = useState(null);
    const pageRefs = useRef([]);
    const containerRef = useRef(null);

    const playFlipSound = () => {
        const sound = new Audio("/page-flip.mp3");
        sound.volume = 0.1; // Set volume to 50%
        sound.play().catch((err) => console.warn("Flip sound error:", err));
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
        <div className="flipbook-wrapper">
            <div className="toolbar" style={{ marginBottom: 10 }}>
                {!isAssistantOpen && (
                    <button className="ocr-toggle-button" onClick={() => setIsOCRMode(true)}>
                        Select Text
                    </button>
                )}
            </div>

            <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<p>Loading…</p>}
            >
                <div ref={containerRef} style={{ position: "relative" }}>
                    <HTMLFlipBook
                        width={width}
                        height={width * 1.414}
                        size="stretch"
                        showCover
                        className="flip-book"
                        onFlip={playFlipSound}
                        style={{ pointerEvents: isOCRMode ? "none" : "auto" }}
                    >
                        {numPages &&
                            Array.from({ length: numPages }, (_, i) => {
                                if (!pageRefs.current[i]) pageRefs.current[i] = React.createRef();
                                return (
                                    <FlipPage
                                        key={i}
                                        ref={pageRefs.current[i]}
                                        pageNumber={i + 1}
                                        width={width}
                                    />
                                );
                            })}
                    </HTMLFlipBook>

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
                </div>
            </Document>
        </div>
    );
}

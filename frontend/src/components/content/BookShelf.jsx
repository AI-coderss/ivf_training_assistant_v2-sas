// src/components/content/BookShelf.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/content/BookShelf.css";
import useReaderToolsStore from "../../store/readerToolsStore";

// ✅ pdf.js via react-pdf's pdfjs, with ZERO CDN worker
import { pdfjs } from "react-pdf";

// ✅ Serve worker locally from /public (no CDN dependency)
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.mjs`;

// Book image paths are in /public/images/
const STATIC_BOOKS = [
  {
    id: "static-1",
    title: "Practical Manual Of In Vitro Fertilization",
    image: "/images/manual.png",
    url: "/pdf/manual.pdf",
    static: true,
  },
  {
    id: "static-2",
    title: "Fertility Cryopreservation",
    image: "/images/cryopreservation.png",
    url: "/pdf/cryopreservation.pdf",
    static: true,
  },
  {
    id: "static-3",
    title: "The Ethics Of IVF",
    image: "/images/ethics.png",
    url: "/pdf/ethics.pdf",
    static: true,
  },
  {
    id: "static-4",
    title: "Boston Handbook Of Infertility",
    image: "/images/bostonIvf.png",
    url: "/pdf/boston.pdf",
    static: true,
  },
  {
    id: "static-5",
    title: "How to prepare endometrium",
    image: "/images/endo.png",
    url: "/pdf/endo.pdf",
    static: true,
  },
  {
    id: "static-6",
    title: "How to Prepare Eggs for IVF",
    image: "/images/egg.png",
    url: "/pdf/eggs_preparation.pdf",
    static: true,
  },
  {
    id: "static-7",
    title: "Handbook For Infertility",
    image: "/images/ivf.png",
    url: "/pdf/ivf_handbook.pdf",
    static: true,
  },
];

const LS_KEY = "bookshelf_uploaded_books_v1";

const BookShelf = ({ onSelectBook, selectedBookUrl }) => {
  const fileRef = useRef(null);
  const openTool = useReaderToolsStore((s) => s.openTool);

  const [uploadedBooks, setUploadedBooks] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      if (Array.isArray(saved)) setUploadedBooks(saved);
    } catch {
      setUploadedBooks([]);
    }
  }, []);

  const persistUploaded = (next) => {
    setUploadedBooks(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error(e);
      alert(
        "Saving failed (PDF too large for localStorage). Use smaller PDFs or store in IndexedDB/backend."
      );
    }
  };

  const handleUploadClick = () => fileRef.current?.click();

  // ---------- Helpers ----------
  const readAsArrayBuffer = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsArrayBuffer(file);
    });

  const readAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  // ✅ Render FIRST PAGE of PDF as image cover (NO placeholder)
  const renderFirstPageAsCover = async (arrayBuffer) => {
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const page = await pdf.getPage(1);

    // target width for crisp covers
    const targetWidth = 520;

    const viewport1 = page.getViewport({ scale: 1 });
    const scale = targetWidth / viewport1.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    // JPEG reduces storage pressure vs PNG
    const coverDataUrl = canvas.toDataURL("image/jpeg", 0.9);

    // cleanup
    canvas.width = 1;
    canvas.height = 1;

    return coverDataUrl;
  };

  const handleUpload = async (file) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }

    try {
      // 1) Load PDF bytes for cover render
      const arrayBuffer = await readAsArrayBuffer(file);

      // 2) Generate cover from page 1 (NO placeholders)
      const coverDataUrl = await renderFirstPageAsCover(arrayBuffer);

      // 3) Store full PDF as data URL (same behavior as before)
      const pdfDataUrl = await readAsDataURL(file);

      const newBook = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.pdf$/i, ""),
        image: coverDataUrl, // ✅ real cover from page 1
        url: pdfDataUrl,
        static: false,
      };

      persistUploaded([newBook, ...uploadedBooks]);
    } catch (err) {
      console.error(err);
      alert(
        "Could not generate a cover from this PDF (page 1). Please try another PDF."
      );
    }
  };

  const removeUploaded = (id) => {
    persistUploaded(uploadedBooks.filter((b) => b.id !== id));
  };

  const books = useMemo(
    () => [...uploadedBooks, ...STATIC_BOOKS],
    [uploadedBooks]
  );

  const openToolFromBook = (action, book) => {
    if (book?.url) onSelectBook(book.url);

    const tool =
      action === "quiz" ? "quizzes" : action === "ask" ? "chat" : "summary";

    openTool(tool, {
      source: "bookshelf",
      action,
      book: { id: book.id, title: book.title, url: book.url },
    });
  };

  return (
    <div className="bookshelf">
      <h3 className="shelf-title">📚 Digital Books</h3>

      {/* ✅ Add Book is a REAL button (no image) sized as a 3D book */}
      <div className="book-item add-book" title="Upload PDF">
        <button
          type="button"
          className="add-book-btn"
          onClick={handleUploadClick}
        >
          <span className="add-book-plus" aria-hidden>
            +
          </span>
          <span className="add-book-title">Add Book</span>
          <span className="add-book-subtitle">Upload PDF</span>
          <span className="add-book-ring" aria-hidden />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={(e) => handleUpload(e.target.files?.[0])}
      />

      {books.map((book) => (
        <div
          key={book.id}
          className={`book-item ${
            selectedBookUrl === book.url ? "selected" : ""
          }`}
          onClick={() => onSelectBook(book.url)}
          title={book.title}
        >
          <img src={book.image} alt={book.title} className="book-image" />

          {!book.static && (
            <button
              className="remove-book"
              aria-label="Remove book"
              title="Remove"
              onClick={(e) => {
                e.stopPropagation();
                removeUploaded(book.id);
              }}
            >
              ✕
            </button>
          )}

          {/* ✅ AI menu */}
          <div
            className="ai-badge"
            tabIndex={0}
            role="button"
            aria-label="AI actions"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            🤖 AI
            <div className="ai-menu" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openToolFromBook("summarize", book)}
              >
                Summarize
              </button>
              <button
                type="button"
                onClick={() => openToolFromBook("explain", book)}
              >
                Explain
              </button>
              <button type="button" onClick={() => openToolFromBook("quiz", book)}>
                Quiz
              </button>
              <button type="button" onClick={() => openToolFromBook("ask", book)}>
                Ask
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BookShelf;






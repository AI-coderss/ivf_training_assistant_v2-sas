// src/components/content/BookShelf.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/content/BookShelf.css";
import useReaderToolsStore from "../../store/readerToolsStore";

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

  const handleUpload = (file) => {
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }

    // NOTE: Storing PDFs as data URLs can exceed localStorage limits for big PDFs.
    const reader = new FileReader();
    reader.onload = () => {
      const pdfDataUrl = reader.result;

      const newBook = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.pdf$/i, ""),
        image: "/images/pdf-placeholder.png", // keep your placeholder cover image
        url: pdfDataUrl,
        static: false,
      };

      persistUploaded([newBook, ...uploadedBooks]);
    };
    reader.onerror = () => alert("Upload failed. Please try again.");
    reader.readAsDataURL(file);
  };

  const removeUploaded = (id) => {
    persistUploaded(uploadedBooks.filter((b) => b.id !== id));
  };

  const books = useMemo(() => [...uploadedBooks, ...STATIC_BOOKS], [uploadedBooks]);

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

      {/* ✅ Add Book is now a REAL button (no image) but sized as a 3D book */}
      <div className="book-item add-book" title="Upload PDF">
        <button type="button" className="add-book-btn" onClick={handleUploadClick}>
          <span className="add-book-plus" aria-hidden>
            +
          </span>
          <span className="add-book-title">Add Book</span>
          <span className="add-book-subtitle">Upload PDF</span>

          {/* Optional subtle ring for “premium” feel */}
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
          className={`book-item ${selectedBookUrl === book.url ? "selected" : ""}`}
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

          {/* ✅ AI menu (clickable + stable hover) */}
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
              <button type="button" onClick={() => openToolFromBook("summarize", book)}>
                Summarize
              </button>
              <button type="button" onClick={() => openToolFromBook("explain", book)}>
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





// src/components/Summary/SummaryBookShelf.jsx
import React from "react";
import "../../styles/Summary/BookShelf.css";

// Only summarizable books (with valid PDF paths)
const summarizableBooks = [
  {
    id: 1,
    title: "Practical Manual Of In Vitro Fertilization",
    image: "/images/manual.png",
    pdfUrl: "/pdfs/manual.pdf",
  },
  {
    id: 2,
    title: "Fertility Cryopreservation",
    image: "/images/cryopreservation.png",
    pdfUrl: "/pdfs/cryopreservation.pdf",
  },
  {
    id: 3,
    title: "The Ethics Of IVF",
    image: "/images/ethics.png",
    pdfUrl: "/pdfs/ethics.pdf",
  },
  {
    id: 4,
    title: "Boston Handbook Of Infertility",
    image: "/images/bostonIvf.png",
    pdfUrl: "/pdfs/boston.pdf",
  },
  {
    id: 5,
    title: "How to prepare endometrium ",
    image: "/images/endo.png",
    pdfUrl: "/pdfs/endo.pdf",
  },
];

const SummaryBookShelf = ({ onSelectBook, selectedBookUrl }) => {
  return (
    <div className="bookshelf">
      <h3 className="shelf-title">📘 Select a Book for Summary</h3>
      {summarizableBooks.map((book) => (
        <div
          key={book.id}
          className={`book-item ${selectedBookUrl === book.pdfUrl ? "selected" : ""}`}
          onClick={() => onSelectBook(book)} // returns full book object
        >
          <img src={book.image} alt={book.title} className="book-image" />
          <div className="book-title">{book.title}</div>
        </div>
      ))}
    </div>
  );
};

export default SummaryBookShelf;

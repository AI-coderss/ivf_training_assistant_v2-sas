// src/components/content/BookShelf.jsx
import React from "react";
import "../../styles/content/BookShelf.css";

// Book image paths are in /public/images/
// PDF paths are assumed to be in /public/pdfs/
const books = [
  {
    id: 1,
    title: "Practical Manual Of In Vitro Fertilization",
    image: "/images/manual.png",
    url: "https://heyzine.com/flip-book/a1a2f21a60.html",
    pdfUrl: "/pdfs/manual.pdf", // Example PDF path
  },
  {
    id: 2,
    title: "Fertility Cryopreservation",
    image: "/images/cryopreservation.png",
    url: "https://heyzine.com/flip-book/9eaacb692e.html",
    pdfUrl: "/pdfs/cryopreservation.pdf", // Example PDF path
  },
  {
    id: 3,
    title: "The Ethics Of IVF",
    image: "/images/ethics.png",
    url: "https://heyzine.com/flip-book/b296d506ea.html",
    pdfUrl: "/pdfs/ivf_ethics.pdf", // Example PDF path
  },
  {
    id: 4,
    title: "Boston Handbook Of Infertility",
    image: "/images/bostonIvf.png",
    url: "https://heyzine.com/flip-book/d90118581a.html",
    pdfUrl: "/pdfs/ivf_handbook.pdf", // Example PDF path
  },
  {
    id: 5,
    title: "How to prepare endometrium ",
    image: "/images/endo.png",
    url: "https://heyzine.com/flip-book/30f4394f2a.html",
    pdfUrl: "/pdfs/endo.pdf", // Example PDF path
  },
  {
    id: 6,
    title: "How to Prepare Eggs for IVF",
    image: "/images/egg.png",
    url: "https://heyzine.com/flip-book/1f97ea61c2.html",
    pdfUrl: "/pdfs/eggs_preparation.pdf", // Example PDF path
  },
  {
    id: 7,
    title: "Handbook For Infertility",
    image: "/images/ivf.png",
    url: "https://heyzine.com/flip-book/b6b460f174.html",
    pdfUrl: "/pdfs/boston.pdf", // Example PDF path
  },
];

const BookShelf = ({ onSelectBook, selectedBookUrl }) => {
  return (
    <div className="bookshelf">
      <h3 className="shelf-title">📚 Digital Books</h3>
      {books.map((book) => (
        <div
          key={book.id}
          className={`book-item ${
            selectedBookUrl === book.url ? "selected" : ""
          }`}
          onClick={() => onSelectBook(book)} // Pass the whole book object
        >
          <img src={book.image} alt={book.title} className="book-image" />
          <div className="book-title">{book.title}</div>
        </div>
      ))}
    </div>
  );
};

export default BookShelf;


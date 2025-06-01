// src/components/content/BookShelf.jsx
import React from "react";
import "../../styles/content/BookShelf.css";

// Book image paths are in /public/images/
const books = [
  {
    id: 1,
    title: "Practical Manual Of In Vitro Fertilization",
    image: "/images/manual.png", // make sure this exists in public/images
    url: "https://heyzine.com/flip-book/a1a2f21a60.html",
  },
  {
    id: 2,
    title: "Fertility Cryopreservation",
    image: "/images/cryopreservation.png", // make sure this exists in public/images
    url: "https://heyzine.com/flip-book/9eaacb692e.html",
  },
   {
    id: 3,
    title: "The Ethics Of IVF",
    image: "/images/ethics.png", // make sure this exists in public/images
    url: "https://heyzine.com/flip-book/b296d506ea.html",
  },
   {
    id: 4,
    title: "Boston Handbook Of Infertility",
    image: "/images/bostonIvf.png", // make sure this exists in public/images
    url: "https://heyzine.com/flip-book/d90118581a.html",
  },
  {
    id: 5,
    title: "How to prepare endometrium ",
    image: "/images/endo.png", // make sure this exists in public/images
    url: "https://heyzine.com/flip-book/30f4394f2a.html",
  }
  ,
  {
    id: 6,
    title: "How to Prepare Eggs for IVF",
    image: "/images/egg.png", // make sure this exists in public/images
    url: "https://heyzine.com/flip-book/1f97ea61c2.html",
  }
  ,
  {
    id: 7,
    title: "Handbook For Infertility",
    image: "/images/ivf.png", // make sure this exists in public/images
    url: "https://heyzine.com/flip-book/b6b460f174.html",
  }
];

const BookShelf = ({ onSelectBook, selectedBookUrl }) => {
  return (
    <div className="bookshelf">
      <h3 className="shelf-title">📚 Digital Books</h3>
      {books.map((book) => (
        <div
          key={book.id}
          className={`book-item ${selectedBookUrl === book.url ? "selected" : ""}`}
          onClick={() => onSelectBook(book.url)}
        >
          <img src={book.image} alt={book.title} className="book-image" />
          <div className="book-title">{book.title}</div>
        </div>
      ))}
    </div>
  );
};

export default BookShelf;


// src/components/content/BookShelf.jsx
import React from "react";
import "../../styles/content/BookShelf.css";

// Book image paths are in /public/images/
const books = [
  {
    id: 1,
    title: "Practical Manual Of In Vitro Fertilization",
    image: "/images/manual.png", // make sure this exists in public/images
    url: "/pdf/manual.pdf",
  },
  {
    id: 2,
    title: "Fertility Cryopreservation",
    image: "/images/cryopreservation.png", // make sure this exists in public/images
    url: "/pdf/cryopreservation.pdf",
  },
   {
    id: 3,
    title: "The Ethics Of IVF",
    image: "/images/ethics.png", // make sure this exists in public/images
    url: "/pdf/ethics.pdf",
  },
   {
    id: 4,
    title: "Boston Handbook Of Infertility",
    image: "/images/bostonIvf.png", // make sure this exists in public/images
    url: "/pdf/boston.pdf",
  },
  {
    id: 5,
    title: "How to prepare endometrium ",
    image: "/images/endo.png", // make sure this exists in public/images
    url: "/pdf/endo.pdf",
  }
  ,
  {
    id: 6,
    title: "How to Prepare Eggs for IVF",
    image: "/images/egg.png", // make sure this exists in public/images
    url: "/pdf/eggs_preparation.pdf",
  }
  ,
  {
    id: 7,
    title: "Handbook For Infertility",
    image: "/images/ivf.png", // make sure this exists in public/images
    url: "/pdf/ivf_handbook.pdf",
  }
];

const BookShelf = ({ onSelectBook, selectedBookUrl }) => {
  return (
    <div className="bookshelf">
      <h3 className="shelf-title">📚 Digital Books</h3>
      {books.map((book) => (
        <div
          key={book.id}
          className={`book-item ${selectedBookUrl === book.url ? 'selected' : ''}`}
          onClick={() => onSelectBook(book.url)}
        >
          <img src={book.image} alt={book.title} className="book-image" />
        </div>
      ))}
    </div>
  );
};

export default BookShelf;
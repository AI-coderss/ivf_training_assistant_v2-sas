import React from "react";
import "../styles/SearchLoader.css";

const SearchLoader = () => (
  <div className="search-loader-container">
    <div className="search-contact-card">
      <div className="search-avatar"></div>
      <div className="search-text"></div>
    </div>
    <div className="search-contact-card">
      <div className="search-avatar"></div>
      <div className="search-text"></div>
    </div>
    <div id="magnifying-glass">
      <div id="glass"></div>
      <div id="handle">
        <div id="handle-inner"></div>
      </div>
    </div>
  </div>
);

export default SearchLoader;

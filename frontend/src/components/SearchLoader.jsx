import React from 'react';
import '../styles/SearchLoader.css'; // Ensure you have the correct path to your CSS file


const SearchLoader = () => {
  return (
    <div className="loader-container">
      <div className="contact-card">
        <div className="avatar"></div>
        <div className="text"></div>
      </div>
      <div className="contact-card">
        <div className="avatar"></div>
        <div className="text"></div>
      </div>
      <div id="magnifying-glass">
        <div id="glass"></div>
        <div id="handle">
          <div id="handle-inner"></div>
        </div>
      </div>
    </div>
  );
};

export default SearchLoader;
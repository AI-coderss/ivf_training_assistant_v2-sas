// components/ui/Dropdown.jsx
import React, { useState, useRef, useEffect } from "react";
import "../styles/content/Dropdown.css";

const Dropdown = ({ label, value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef && dropdownRef.current && !dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleOptionClick = (option) => {
    onChange(option);
    setIsOpen(false);
  };

  return (
    <div className="custom-dropdown-wrapper" ref={dropdownRef}>
      <label className="card-label">{label}</label>
      <div
        className={`custom-dropdown ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="selected-option">{value}</div>
        <span className="dropdown-arrow">▼</span>
        {isOpen && (
          <div className="dropdown-options">
            {options.map((option) => (
              <div
                key={option}
                className={`dropdown-option ${value === option ? "selected" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOptionClick(option);
                }}
              >
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dropdown;
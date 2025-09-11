import React from "react";
import "../styles/Quizzes/bulletsSummary.css";
import SaveAndCopy from "../components/actions/SaveAndCopy";

export default function BulletsSummary({
  length = "short",
  Summary,
  isLoading,
  onNavigateToPage
}) {
  const selected = length.toLowerCase();

  // Show loading state if data is being fetched
  if (isLoading) {
    return (
      <div className="bullets-summary">
        <div className="loading-container">
          <p>Loading summary data...</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  // Enhanced data extraction with fallbacks
  let bulletPoints = [];
  
  if (Summary?.summaries?.[selected]) {
    // Preferred structure with summaries object
    bulletPoints = Summary.summaries[selected];
  } else if (Array.isArray(Summary?.[selected])) {
    // Direct array access
    bulletPoints = Summary[selected];
  } else if (typeof Summary?.[selected] === "string") {
    // String that needs to be split into bullets
    bulletPoints = Summary[selected].split("\n").filter(line => line.trim() !== "");
  }
  
  // Return null if no bullet points found (only when not loading)
  if (!bulletPoints || bulletPoints.length === 0) return null;

  // Function to handle click on page references
  const handleReferenceClick = (referenceText) => {
    if (onNavigateToPage) {
      onNavigateToPage(referenceText);
    }
  };

  return (
    <div className="bullets-summary">
      <SaveAndCopy
        title={Summary.title || "Summary"}
        author={Summary.auth || "Unknown Author"}
        content={bulletPoints.join("\n")}
      />

      <h4>{length} Summary</h4>
      <ul className="summary-bullets">
        {bulletPoints.map((bullet, index) => (
          <li key={index}>{bullet}</li>
        ))}
      </ul>

      {Summary.source_reference && (
        <div className="source-reference mt-10">
          <a
            href={`#${Summary.source_reference}`}
            onClick={(e) => {
              e.preventDefault();
              handleReferenceClick(Summary.source_reference);
            }}
            className="page-reference-link text-blue-600 underline cursor-pointer"
            title={`Jump to ${Summary.source_reference}`}
          >
            Source Reference: {Summary.source_reference}
          </a>
        </div>
      )}
    </div>
  );
}
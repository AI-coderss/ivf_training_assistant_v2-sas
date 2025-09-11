import React from "react";
import "../../styles/Quizzes/paragraphSummary.css"; // Make sure path is correct

export default function SaveAndCopy({ title, author, content }) {
  const handleCopy = () => {
    const textToCopy = `${title ? title + '\n' : ''}${author ? 'Author: ' + author + '\n\n' : ''}${content}`;
    navigator.clipboard.writeText(textToCopy)
      .then(() => alert("Copied to clipboard!"))
      .catch(() => alert("Failed to copy"));
  };

  const handleSave = () => {
    const docContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office'
            xmlns:w='urn:schemas-microsoft-com:office:word'
            xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'></head>
        <body>
          ${title ? `<h2>${title}</h2>` : ""}
          ${author ? `<p><strong>Author:</strong> ${author}</p>` : ""}
          <p>${content}</p>
        </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', docContent], {
      type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "exported_content.doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="save-copy-wrapper">
      <button onClick={handleCopy} className="copy-button-unique">📋 Copy</button>
      <button onClick={handleSave} className="save-button-unique">💾 Save as .doc</button>
    </div>
  );
}
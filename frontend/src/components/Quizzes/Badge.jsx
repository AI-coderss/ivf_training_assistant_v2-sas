import React from "react";
import "../../styles/Badge.css"; // Make sure this file holds the CSS you shared

const Badge = () => {
  return (
    <main>
      <div className="achievement">
        <div className="icon-outer-container">
          <div className="spark-container">
            <div className="spark">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 12c6.268 0 9-2.637 9-9c0 6.363 2.713 9 9 9c-6.287 0-9 2.713-9 9c0-6.287-2.732-9-9-9Z"
                />
              </svg>
            </div>
            <div className="spark">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 12c6.268 0 9-2.637 9-9c0 6.363 2.713 9 9 9c-6.287 0-9 2.713-9 9c0-6.287-2.732-9-9-9Z"
                />
              </svg>
            </div>
            <div className="spark">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 12c6.268 0 9-2.637 9-9c0 6.363 2.713 9 9 9c-6.287 0-9 2.713-9 9c0-6.287-2.732-9-9-9Z"
                />
              </svg>
            </div>
          </div>
          <div className="icon-inner-container">
            <div className="highlight"></div>
            <div className="icon">
              <div className="highlight" style={{ opacity: 0.25, zIndex: 2 }}></div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="m8.587 8.236l2.598-5.232a.911.911 0 0 1 1.63 0l2.598 5.232l5.808.844a.902.902 0 0 1 .503 1.542l-4.202 4.07l.992 5.75c.127.738-.653 1.3-1.32.952L12 18.678l-5.195 2.716c-.666.349-1.446-.214-1.319-.953l.992-5.75l-4.202-4.07a.902.902 0 0 1 .503-1.54z"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className="content">
          <span className="title">Achievement Unlocked</span>
          <span className="description">You've scored over 80%! 🌟</span>
        </div>
      </div>
    </main>
  );
};

export default Badge;

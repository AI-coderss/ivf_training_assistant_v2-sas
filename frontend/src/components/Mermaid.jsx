// src/components/Mermaid.js

import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// It's good practice to initialize Mermaid once when the app loads,
// for example, in your main App.js or index.js.
// If you do it here, make sure it only runs once.
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base', // or 'dark', 'forest', 'neutral'
    securityLevel: 'loose',
    fontFamily: 'inherit',
  });
} catch (e) {
  console.error("Mermaid initialization failed", e);
}


const Mermaid = ({ chart }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (chart && containerRef.current) {
      // Generate a unique ID for each render to avoid conflicts
      const id = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;

      // The callback receives the SVG code
      const renderCallback = (svgCode) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svgCode;
        }
      };

      try {
        // mermaid.render(id, chart, renderCallback, containerRef.current);
        // Updated and safer way for modern Mermaid versions:
        mermaid.render(id, chart, renderCallback);
      } catch (e) {
         // It's possible for the chart string to be malformed.
         // In this case, we can show an error or the raw text.
        if (containerRef.current) {
            containerRef.current.innerHTML = `<pre>Error rendering diagram:\n${chart}</pre>`;
        }
        console.error("Mermaid rendering failed for chart:", chart, e);
      }
    }
  }, [chart]); // Rerun this effect only when the 'chart' prop changes

  // Set a key on the div to force React to re-mount the component
  // when the chart text changes. This helps in cleaning up old diagrams.
  return <div key={chart} ref={containerRef} />;
};

export default Mermaid;
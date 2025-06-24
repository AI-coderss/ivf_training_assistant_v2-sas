// src/components/Mermaid.js

import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

// Initialize once globally
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
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
      const id = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;

      try {
        // ✅ Validate Mermaid syntax first
        mermaid.parse(chart);

        // ✅ Create a dummy temp div as target
        const tempDiv = document.createElement('div');

        // ✅ Render into the temp div
        mermaid.render(id, chart, (svgCode) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = svgCode;
          }
        }, tempDiv);
      } catch (e) {
        // If parse or render fails, show raw text
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre>Invalid Mermaid syntax:\n${chart}</pre>`;
        }
        console.error("Mermaid rendering failed for chart:", chart, e);
      }
    }
  }, [chart]);

  return <div key={chart} ref={containerRef} />;
};

export default Mermaid;

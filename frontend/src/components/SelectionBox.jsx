import { useState, useRef, useEffect } from "react";

export default function SelectionBox({ onBoxReady, containerRef }) {
  const [box, setBox] = useState(null);
  const start = useRef(null);

  const getPos = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const isTouch = e.touches && e.touches.length > 0;
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const begin = (e) => {
    const { x, y } = getPos(e);
    start.current = { x, y };
    setBox({ x, y, w: 0, h: 0 });
  };

  const move = (e) => {
    if (!start.current) return;
    const { x, y } = getPos(e);
    setBox({
      x: Math.min(start.current.x, x),
      y: Math.min(start.current.y, y),
      w: Math.abs(start.current.x - x),
      h: Math.abs(start.current.y - y),
    });
  };

  const end = (e) => {
    if (box) {
      onBoxReady(box);
    }
    setBox(null);
    start.current = null;
  };

  useEffect(() => {
    const preventScroll = (e) => {
      if (start.current) e.preventDefault();
    };
    document.addEventListener("touchmove", preventScroll, { passive: false });
    return () => document.removeEventListener("touchmove", preventScroll);
  }, []);

  return (
    <div
      className="selection-overlay"
      onMouseDown={begin}
      onMouseMove={move}
      onMouseUp={end}
      onTouchStart={begin}
      onTouchMove={move}
      onTouchEnd={end}
    >
      {box && (
        <div
          className="selection-rectangle"
          style={{
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
          }}
        />
      )}
    </div>
  );
}

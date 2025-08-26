import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Howl } from "howler";
import "../styles/Navbar.css";

const Navbar = () => {
  const location = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const navSoundRef = useRef(null);

  const menuItems = useMemo(
    () => [
      { label: "Home 🏠", path: "/" },
      { label: "Quizzes 🧠", path: "/quizzes" },
      // { label: "Summaries 📚", path: "/summaries" },
      { label: "Digital Content 🎥", path: "/content" },
      { label: "Talk to Avatar 🤖", path: "/avatar" },
    ],
    []
  );

  useEffect(() => {
    navSoundRef.current = new Howl({ src: ["/nav.wav"], volume: 0.01 });
    return () => {
      try { navSoundRef.current?.unload(); } catch (_) {}
    };
  }, []);

  useEffect(() => {
    const i = menuItems.findIndex((it) => it.path === location.pathname);
    setActiveIndex(i >= 0 ? i : 0);
    setMenuOpen(false);
  }, [location.pathname, menuItems]);

  useEffect(() => {
    document.body.classList.toggle("nav-lock", menuOpen);
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    if (menuOpen) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleNavigation = (index) => {
    setActiveIndex(index);
    setMenuOpen(false);
    navSoundRef.current?.play();
  };

  return (
    <nav className="nav" role="navigation" aria-label="Main">
      {/* Left: Brand */}
      <div className="nav__brand">
        <Link to="/" className="nav__logo" aria-label="Home">
          <img src="./logo.png" alt="logo" />
        </Link>
      </div>

      {/* Center: Desktop links */}
      <ul className="nav__links" role="menubar">
        {menuItems.map((item, idx) => (
          <li key={item.path} role="none">
            <Link
              to={item.path}
              role="menuitem"
              className={`nav__link ${activeIndex === idx ? "active" : ""}`}
              onClick={() => handleNavigation(idx)}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* Right: Hamburger (mobile) */}
      <button
        className={`nav__hamburger ${menuOpen ? "is-open" : ""}`}
        aria-label="Open menu"
        aria-controls="mobile-drawer"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Mobile overlay + drawer */}
      <div
        className={`nav__overlay ${menuOpen ? "show" : ""}`}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        id="mobile-drawer"
        className={`nav__drawer ${menuOpen ? "open" : ""}`}
        aria-hidden={!menuOpen}
      >
        <div className="nav__drawerHeader">
          <img src="./logo.png" alt="logo" />
          <button
            className="nav__close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="nav__drawerMenu" role="menu">
          {menuItems.map((item, idx) => (
            <Link
              key={item.path}
              to={item.path}
              role="menuitem"
              className={`nav__drawerLink ${
                activeIndex === idx ? "active" : ""
              }`}
              onClick={() => handleNavigation(idx)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </nav>
  );
};

export default Navbar;






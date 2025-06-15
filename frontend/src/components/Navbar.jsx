import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Howl } from "howler";
import "../styles/Navbar.css";

const Navbar = () => {
  const location = useLocation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const menuItems = [
    { label: "Home 🏠", path: "/" },
    { label: "Quizzes 🧠", path: "/quizzes" },
    //{ label: "Summaries 📚", path: "/summaries" },
    { label: "Digital Content 🎥", path: "/content" },
    { label: "Talk to Avatar 🤖", path: "/avatar" },
  ];

  // Sound effect on navigation
  const navSound = new Howl({
    src: ["/nav.wav"],
    volume: 0.05,
  });

  // Set the active index based on current route
  useEffect(() => {
    const index = menuItems.findIndex((item) => item.path === location.pathname);
    setActiveIndex(index >= 0 ? index : 0);
  }, [location.pathname, menuItems]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNavigation = (index) => {
    setActiveIndex(index);
    setMenuOpen(false);
    navSound.play();
  };

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  return (
    <div className="nav">
      <div className="navLogo">
        <img src="./logo.png" alt="logo" height="80px" width="auto" />
      </div>

      {isMobile ? (
        // Mobile: Hamburger Menu
        <div className="burgerMenu">
          <div className="burgerIcon" onClick={toggleMenu}>
            <div className="bar" />
            <div className="bar" />
            <div className="bar" />
          </div>
          {menuOpen && (
            <div className="dropdownMenu">
              {menuItems.map((item, index) => (
                <Link
                  to={item.path}
                  key={index}
                  className={`mobileNavItem ${activeIndex === index ? "active" : ""}`}
                  onClick={() => handleNavigation(index)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Desktop: Full Menu with Active Tab Animation
        <div className="navItemContainer">
          {menuItems.map((item, index) => (
            <Link
              to={item.path}
              key={index}
              className={`navItem ${activeIndex === index ? "active" : ""}`}
              onClick={() => handleNavigation(index)}
            >
              {item.label}
            </Link>
          ))}

          <div
            className="navItemActiveContainer"
            style={{ transform: `translateX(${activeIndex * 200}px)` }} // 200px = .navItem width
          >
            <div className="navItemActive">
              <div className="navItemActiveLeft"></div>
              <div className="navItemActiveCenter"></div>
              <div className="navItemActiveRight"></div>
            </div>
            <div className="navItemActive">
              <div className="navItemActiveCopyLeft"></div>
              <div className="navItemActiveCopyCenter"></div>
              <div className="navItemActiveCopyRight"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Navbar;



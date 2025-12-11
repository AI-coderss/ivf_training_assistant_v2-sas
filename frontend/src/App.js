import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import "./App.css";
import ChatPage from "./pages/ChatPage";
import QuizzesPage from "./pages/QuizzesPage";
import ContentPage from "./pages/ContentPage";
import AvatarPage from "./pages/AvatarPage";
import AuthPage from "./components/AuthPage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const BACKEND_BASE = "https://ivf-backend-server.onrender.com";
const TOKEN_KEY = "token";

const clearAuthSession = () => {
  [TOKEN_KEY, "email", "roles", "name"].forEach((k) =>
    localStorage.removeItem(k)
  );
};

// Simple auth guard that validates the bearer token before rendering protected routes.
const RequireAuth = ({ children }) => {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setStatus("unauthorized");
      return;
    }

    fetch(`${BACKEND_BASE}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          setStatus("authorized");
        } else {
          clearAuthSession();
          setStatus("unauthorized");
        }
      })
      .catch(() => {
        clearAuthSession();
        setStatus("unauthorized");
      });
  }, []);

  if (status === "checking") return null;
  if (status === "unauthorized") return <Navigate to="/auth" replace />;
  return children;
};

function App() {
  // Hide navbar on the auth page so the auth shell fully covers the UI.
  const location = useLocation();
  const hideNavbar = location.pathname === "/auth";

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route
          path="/quizzes"
          element={
            <RequireAuth>
              <QuizzesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/content"
          element={
            <RequireAuth>
              <ContentPage />
            </RequireAuth>
          }
        />
        <Route
          path="/avatar"
          element={
            <RequireAuth>
              <AvatarPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>

      <ToastContainer position="top-right" autoClose={4000} />
    </>
  );
}

// Wrap Router so we can use location for navbar visibility.
const AppWithRouter = () => (
  <Router>
    <App />
  </Router>
);

export default AppWithRouter;

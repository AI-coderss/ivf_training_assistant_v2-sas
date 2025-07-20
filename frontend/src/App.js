import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import "./App.css";
import ChatPage from "./pages/ChatPage";
import QuizzesPage from "./pages/QuizzesPage";
import ContentPage from "./pages/ContentPage";
import AvatarPage from "./pages/AvatarPage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/quizzes" element={<QuizzesPage />} />
        <Route path="/content" element={<ContentPage />} />
        <Route path="/avatar" element={<AvatarPage />} />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>

      <ToastContainer position="top-right" autoClose={4000} />
    </Router>
  );
}

export default App;
import React from "react";
import { BrowserRouter as Router, Routes, Route,Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import "./App.css";
import ChatPage from "./pages/ChatPage";
import QuizzesPage from "./pages/QuizzesPage";
import SummariesPage from "./pages/SummariesPage";
import ContentPage from "./pages/ContentPage";
import AvatarPage from "./pages/AvatarPage";


function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          {/* Explicit routes */}
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/quizzes" element={<QuizzesPage />} />
          <Route path="/summaries" element={<SummariesPage />} />
          <Route path="/content" element={<ContentPage />} />
          <Route path="/avatar" element={<AvatarPage />} />
          {/* Fallback: unmatched routes go back to home or a 404 page */}
          <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </Router>
  );
}

export default App;


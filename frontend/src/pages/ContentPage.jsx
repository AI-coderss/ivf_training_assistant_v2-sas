import React, { useState } from "react";
import "../styles/content/ContentPage.css";
import BookViewer from "../components/content/BookViewer";
import VoiceAssistant from "../components/content/VoiceAssistant";
import BookShelf from "../components/content/BookShelf";

const ContentPage = () => {
  const [voiceAssistantVisible, setVoiceAssistantVisible] = useState(false);
  const [selectedBookUrl, setSelectedBookUrl] = useState(
    "https://heyzine.com/flip-book/9eaacb692e.html"
  );

  const toggleVoiceAssistant = () => {
    setVoiceAssistantVisible((prev) => !prev);
  };

  return (
    <div className="page-container">
      <div className="content-header">
        <h2>Training Content 📚</h2>
        <p>Explore IVF training materials and digital handbooks.</p>
        <button className="toggle-voice-btn" onClick={toggleVoiceAssistant}>
          {voiceAssistantVisible
            ? "❌ Hide AI Assistant"
            : "Explain with AI Assistant✨"}
        </button>
      </div>

      <div className="content-layout">
        <div className="bookshelf-wrapper">
          <BookShelf
            onSelectBook={setSelectedBookUrl}
            selectedBookUrl={selectedBookUrl}
          />
        </div>

        <div
          className={`viewer-column ${
            voiceAssistantVisible ? "with-assistant" : ""
          }`}
        >
          <BookViewer selectedBookUrl={selectedBookUrl} />
        </div>

        {voiceAssistantVisible && (
          <div className="voice-column">
            <VoiceAssistant
              isVisible={voiceAssistantVisible}
              onClose={toggleVoiceAssistant}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentPage;

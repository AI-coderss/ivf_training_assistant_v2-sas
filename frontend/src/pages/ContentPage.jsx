import React, { useState } from 'react';
import '../styles/content/ContentPage.css';
import BookViewer from '../components/content/BookViewer';
import VoiceAssistant from '../components/content/VoiceAssistant';
import BookShelf from '../components/content/BookShelf';

const ContentPage = () => {
  const [voiceAssistantVisible, setVoiceAssistantVisible] = useState(false);
  const [selectedBookUrl, setSelectedBookUrl] = useState('/pdf/manual.pdf');
  const [ocrContext, setOcrContext] = useState('');
  const [showBookshelf, setShowBookshelf] = useState(false);

  const isMobile = window.innerWidth <= 1024;

  const toggleVoiceAssistant = () => {
    setVoiceAssistantVisible(prev => !prev);
  };

  const handleOCRText = (text) => {
    setOcrContext(text);
    setVoiceAssistantVisible(true);
  };

  const handleSelectBook = (bookUrl) => {
    setSelectedBookUrl(bookUrl);
    if (isMobile) setShowBookshelf(false);
  };

  return (
    <div className="page-container">
      <div className="content-header">
        <h2>Training Content 📚</h2>
        <p>Explore IVF training materials and digital handbooks.</p>
        {isMobile && !voiceAssistantVisible && (
          <button className="toggle-bookshelf-btn" onClick={() => setShowBookshelf(prev => !prev)}>
            {showBookshelf ? 'Hide Books' : 'Show Books'}
          </button>
        )}
        {(!isMobile || !showBookshelf) && (
          <button className="toggle-voice-btn" onClick={toggleVoiceAssistant}>
            {voiceAssistantVisible ? '❌ Hide AI Assistant' : 'AI Assistant✨'}
          </button>
        )}

      </div>

      <div className="content-layout">
        {(!isMobile || showBookshelf) && (
          <div className="bookshelf-scroll-wrapper">
            <div className="bookshelf-wrapper">
              <BookShelf
                onSelectBook={handleSelectBook}
                selectedBookUrl={selectedBookUrl}
              />
            </div>
          </div>
        )}

        <div className={`viewer-column ${voiceAssistantVisible ? 'with-assistant' : ''}`}>
          <BookViewer
            selectedBookUrl={selectedBookUrl}
            onOCRText={handleOCRText}
            isAssistantOpen={voiceAssistantVisible}
          />
        </div>

        {voiceAssistantVisible && (
          isMobile ? (
            <VoiceAssistant
              isVisible={true}
              onClose={toggleVoiceAssistant}
              context={ocrContext}
            />
          ) : (
            <div className="voice-column">
              <VoiceAssistant
                isVisible={true}
                onClose={toggleVoiceAssistant}
                context={ocrContext}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default ContentPage;

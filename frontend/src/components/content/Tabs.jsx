/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import ChatWithYourBook from "./ChatWithYourBook";
import "../../styles/content/Tabs.css";
import ParagrapfSummary from "../../pages/ParagrapfSummary";
import BulletsSummary from "../../pages/BulletsSummary";
import useBookStore from "../../store/bookStore";
import Dropdown from "../Dropdown";
import QuizzesPanel from "./Quizzes.jsx";

const Tabs = () => {
  const containerRef = useRef(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [isLoading, setIsLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showQuizzPage, setShowQuizzPage] = useState(false);
  const [showTrueFalseQuiz, setShowTrueFalseQuiz] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const BACKEND_URL_Summary = "https://immersive-reader-realtime-tts-server.onrender.com"; // Your Flask backend URL
  const BACKEND_URL_Chat = "https://chat-with-your-books-server.onrender.com"; // Your Flask backend URL
  // Summary state
  const [summaryConfig, setSummaryConfig] = useState({
    length: "Short",
    mode: "Paragraph",
    tone: "Neutral",
    scope: "Selection",
    note: "",
  });

  // Quiz state
  const [quizConfig, setQuizConfig] = useState({
    type: "Both",
    count: 5,
    note: "",
    difficulty:'easy',
    scope:'current_page'
  });

  // Page range state
  const [pageRange, setPageRange] = useState({
    start: 1,
    end: 1,
    showInputs: false,
  });

  // Zustand store hooks
  const {
    selectedChunkIndex,
    currentPage,
    setCurrentPage,
    pageRanges,
    bookText,
    chunks,
  } = useBookStore();

  // Memoized selected chunk
  const chunk = useMemo(
    () => chunks[selectedChunkIndex],
    [chunks, selectedChunkIndex]
  );

  // Improved current page detection
  useEffect(() => {
    if (!pageRanges.length) return;

    let timeoutId;
    let observer;

    const findPDFContainer = () => {
      // Try to find the PDF container with common selectors
      const selectors = [
        ".react-pdf__Document",
        ".pdf-viewer",
        ".pdf-container",
        '[data-testid="pdf-viewer"]',
        ".document-container",
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }

      // Fallback to any element that might contain PDF pages
      const elements = document.querySelectorAll("*");
      for (const element of elements) {
        if (element.querySelector(".react-pdf__Page")) {
          return element;
        }
      }

      return document;
    };

    const updateCurrentPage = () => {
      const pages = document.querySelectorAll(".react-pdf__Page");
      if (pages.length === 0) {
        return;
      }

      let mostVisiblePage = null;
      let maxVisibility = 0;

      pages.forEach((page) => {
        const pageNumber = parseInt(page.getAttribute("data-page-number"));
        if (!pageNumber) return;

        const rect = page.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Calculate visible area
        const visibleTop = Math.max(
          0,
          Math.min(rect.bottom, viewportHeight) - Math.max(0, rect.top)
        );
        const visibleHeight = Math.max(0, visibleTop);
        const visibleWidth = Math.max(
          0,
          Math.min(rect.right, viewportWidth) - Math.max(0, rect.left)
        );
        const visibleArea = visibleHeight * visibleWidth;
        const totalArea = rect.height * rect.width;
        const visibilityRatio = totalArea > 0 ? visibleArea / totalArea : 0;

        if (visibilityRatio > maxVisibility) {
          maxVisibility = visibilityRatio;
          mostVisiblePage = pageNumber;
        }
      });

      if (
        mostVisiblePage &&
        mostVisiblePage !== currentPage &&
        maxVisibility > 0.3
      ) {
        setCurrentPage(mostVisiblePage);
      }
    };

    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateCurrentPage, 150);
    };

    const setupPageDetection = () => {
      const pdfContainer = findPDFContainer();

      // Set up scroll listener
      pdfContainer.addEventListener("scroll", handleScroll);

      // Set up IntersectionObserver for more precise detection
      const options = {
        root: pdfContainer === document ? null : pdfContainer,
        threshold: 0.3,
      };

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNumber = parseInt(
              entry.target.getAttribute("data-page-number")
            );
            if (pageNumber && pageNumber !== currentPage) {
              setCurrentPage(pageNumber);
            }
          }
        });
      }, options);

      // Observe all pages
      const pages = document.querySelectorAll(".react-pdf__Page");
      pages.forEach((page) => observer.observe(page));

      // Initial update
      updateCurrentPage();

      return () => {
        pdfContainer.removeEventListener("scroll", handleScroll);
        if (observer) {
          observer.disconnect();
        }
      };
    };

    // Wait for pages to be rendered
    const initTimeout = setTimeout(setupPageDetection, 1000);

    return () => {
      clearTimeout(initTimeout);
      clearTimeout(timeoutId);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [pageRanges, currentPage, setCurrentPage]);

  // Initialize page range when scope changes
  useEffect(() => {
    if (summaryConfig.scope === "Page Range" && currentPage > 0) {
      setPageRange((prev) => ({
        ...prev,
        start: currentPage,
        end: Math.min(currentPage + 1, pageRanges.length || 1),
      }));
    }
  }, [summaryConfig.scope, currentPage, pageRanges.length]);

  // Set initial current page if needed
  useEffect(() => {
    if (currentPage === 1 && pageRanges.length > 0) {
      const pageWithContent = pageRanges.find(
        (p) => p.endIndex - p.startIndex > 50
      );
      if (pageWithContent && pageWithContent.pageNumber !== 1) {
        setCurrentPage(pageWithContent.pageNumber);
      }
    }
  }, [pageRanges, currentPage, setCurrentPage]);

  // Function to handle navigation to a page
  const handleNavigateToPage = useCallback(
    (referenceText) => {
      // Extract page numbers from text like "Pages 2-5" or "Page 3"
      const pageMatch = referenceText.match(
        /(?:Pages?\s+)(\d+(?:\s*-\s*\d+)?)/i
      );
      if (pageMatch) {
        const pages = pageMatch[1].split(/\s*-\s*/);
        const startPage = parseInt(pages[0]);

        // Set the current page in your store
        setCurrentPage(startPage);

        // Scroll to the page in your PDF viewer
        scrollToPageInViewer(startPage);
      }
    },
    [setCurrentPage]
  );

  // Function to scroll to a specific page in the PDF viewer
  const scrollToPageInViewer = useCallback((pageNumber) => {
    const pdfContainer =
      document.querySelector(".react-pdf__Document") || document;
    const pageElement = pdfContainer.querySelector(
      `.react-pdf__Page[data-page-number="${pageNumber}"]`
    );

    if (pageElement) {
      pageElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Tab handlers
  const openSummary = useCallback(() => {
    setActiveTab("summary");
    setChatOpen(false);
    setSummaryConfig((prev) => ({ ...prev, note: "" }));
    setQuizConfig((prev) => ({ ...prev, note: "" }));
  }, []);

  const openQuizzes = useCallback(() => {
    setActiveTab("quizzes");
    setChatOpen(false);
    setSummaryConfig((prev) => ({ ...prev, note: "" }));
    setQuizConfig((prev) => ({ ...prev, note: "" }));
  }, []);

  const toggleChat = useCallback(() => {
    if (chatOpen) {
      setChatOpen(false);
      setActiveTab(null);
    } else {
      setChatOpen(true);
      setActiveTab("chat");
    }
    setSummaryConfig((prev) => ({ ...prev, note: "" }));
    setQuizConfig((prev) => ({ ...prev, note: "" }));
  }, [chatOpen]);

  const closeActiveTab = useCallback(() => {
    setActiveTab(null);
  }, []);

  // Get page range for chunk
  const getPageRangeForChunk = useCallback(
    (chunk) => {
      if (!chunk || !pageRanges.length) return null;

      const matchedPages = pageRanges.filter(
        (r) => r.endIndex >= chunk.startIndex && r.startIndex <= chunk.endIndex
      );

      if (!matchedPages.length) return null;

      const pageNumbers = matchedPages.map((p) => p.pageNumber);
      return {
        startPage: Math.min(...pageNumbers),
        endPage: Math.max(...pageNumbers),
        pages: pageNumbers,
      };
    },
    [pageRanges]
  );

  // Generate summary handler - using the more detailed version from your working code
  const handleGenerateSummary = useCallback(async () => {
    setIsLoading(true);
    setSummaryConfig((prev) => ({ ...prev, note: "" }));

    let textForSummary = "";
    let pageInfo = null;

    try {
      switch (summaryConfig.scope) {
        case "Current Page": {
          // Filter out invalid page ranges
          const validPageRanges = pageRanges.filter(
            (p) => p.endIndex >= p.startIndex
          );

          const pageRange = validPageRanges.find(
            (p) => p.pageNumber === currentPage
          );

          if (!pageRange) {
            const availablePages = validPageRanges
              .map((p) => p.pageNumber)
              .join(", ");
            setSummaryConfig((prev) => ({
              ...prev,
              note: `No valid data found for page ${currentPage}. Available pages: ${availablePages}`,
            }));
            setIsLoading(false);
            return;
          }

          textForSummary = bookText.slice(
            pageRange.startIndex,
            pageRange.endIndex + 1
          );

          pageInfo = {
            startPage: currentPage,
            endPage: currentPage,
            pages: [currentPage],
            scope: summaryConfig.scope,
            currentPage: currentPage,
          };

          // If current page has minimal content, include adjacent pages
          if (textForSummary.trim().length < 50) {
            const adjacentPages = validPageRanges
              .filter((p) => Math.abs(p.pageNumber - currentPage) <= 1)
              .slice(0, 3);

            if (adjacentPages.length > 0) {
              textForSummary = adjacentPages
                .map((p) => {
                  const pageText = bookText.slice(p.startIndex, p.endIndex + 1);
                  return `[Page ${p.pageNumber}]\n${pageText}`;
                })
                .join("\n\n");

              const pageNumbers = adjacentPages.map((p) => p.pageNumber);
              pageInfo = {
                startPage: Math.min(...pageNumbers),
                endPage: Math.max(...pageNumbers),
                pages: pageNumbers,
                scope: summaryConfig.scope,
                currentPage: currentPage,
              };
            }
          }
          break;
        }

        case "Page Range": {
          const startPage = Math.max(
            1,
            Math.min(pageRange.start || 1, pageRanges.length)
          );
          const endPage = Math.max(
            startPage,
            Math.min(pageRange.end || startPage, pageRanges.length)
          );

          const pagesInRange = pageRanges.filter(
            (p) =>
              p.pageNumber >= startPage &&
              p.pageNumber <= endPage &&
              p.endIndex >= p.startIndex
          );

          if (pagesInRange.length === 0) {
            setSummaryConfig((prev) => ({
              ...prev,
              note: "No valid pages found in the specified range.",
            }));
            setIsLoading(false);
            return;
          }

          textForSummary = pagesInRange
            .map((p) => {
              const pageText = bookText.slice(p.startIndex, p.endIndex + 1);
              return pageText.trim() ? pageText : "";
            })
            .filter((text) => text.length > 0)
            .join("\n\n");

          pageInfo = {
            startPage: startPage,
            endPage: endPage,
            pages: pagesInRange.map((p) => p.pageNumber),
            scope: summaryConfig.scope,
            currentPage: currentPage,
            customRange: { start: pageRange.start, end: pageRange.end },
          };

          break;
        }

        case "Chapter": {
          const chapterNum = chunk?.chapter;
          if (chapterNum !== undefined) {
            const chapterChunks = chunks.filter(
              (c) => c.chapter === chapterNum
            );
            textForSummary = chapterChunks.map((c) => c.text).join("\n\n");
          } else {
            textForSummary = chunk?.text || "";
          }

          pageInfo = getPageRangeForChunk(chunk);
          if (pageInfo) {
            pageInfo.scope = summaryConfig.scope;
            pageInfo.currentPage = currentPage;
          }
          break;
        }

        case "Selection":
          textForSummary = chunk?.text || "";

          pageInfo = getPageRangeForChunk(chunk);
          if (pageInfo) {
            pageInfo.scope = summaryConfig.scope;
            pageInfo.currentPage = currentPage;
          }
          break;

        case "Entire Book":
          textForSummary = bookText;

          if (pageRanges.length > 0) {
            const validPages = pageRanges.filter(
              (p) => p.endIndex >= p.startIndex
            );
            const allPageNumbers = validPages.map((p) => p.pageNumber);
            pageInfo = {
              startPage: Math.min(...allPageNumbers),
              endPage: Math.max(...allPageNumbers),
              pages: allPageNumbers,
              scope: summaryConfig.scope,
              currentPage: currentPage,
            };
          }

          break;

        default:
          textForSummary = chunk?.text || "";

          pageInfo = getPageRangeForChunk(chunk);
          if (pageInfo) {
            pageInfo.scope = summaryConfig.scope;
            pageInfo.currentPage = currentPage;
          }
      }

      if (!textForSummary || textForSummary.trim().length === 0) {
        setSummaryConfig((prev) => ({
          ...prev,
          note: "No text found for the selected scope.",
        }));
        setIsLoading(false);
        return;
      }

      const payload = {
        text: textForSummary,
        length: summaryConfig.length.toLowerCase(),
        mode: summaryConfig.mode.toLowerCase(),
        tone: summaryConfig.tone.toLowerCase(),
        scope: summaryConfig.scope.toLowerCase(),
        page_info: pageInfo || {
          scope: summaryConfig.scope,
          currentPage: currentPage,
        },
        extras: {
          include_page_references: true,
          extract_key_terms: false,
          include_mini_glossary: false,
        },
      };

      const response = await fetch(
        `${BACKEND_URL_Summary}/api/generate_summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok && data?.result) {
        const formattedData =
          summaryConfig.mode.toLowerCase() === "bullets"
            ? {
                title: "Summary",
                auth: "Book Author",
                summaries: {
                  [summaryConfig.length.toLowerCase()]: data.result
                    .split("\n")
                    .filter((line) => line.trim() !== ""),
                },
                source_reference: data.source_reference,
              }
            : {
                title: "Summary",
                auth: "Book Author",
                [summaryConfig.length.toLowerCase()]: data.result,
                source_reference: data.source_reference,
              };

        setShowSummary(formattedData);
      } else {
        const errorMessage = data?.error || "Summary generation failed";
        setSummaryConfig((prev) => ({
          ...prev,
          note: `Error: ${errorMessage}`,
        }));
      }
    } catch (error) {
      setSummaryConfig((prev) => ({
        ...prev,
        note: "Network error occurred while generating the summary.",
      }));
    } finally {
      setIsLoading(false);
    }
  }, [
    summaryConfig,
    pageRange,
    currentPage,
    pageRanges,
    bookText,
    chunk,
    chunks,
    getPageRangeForChunk,
  ]);

  // Generate quiz handler
  const handleGenerateQuiz = useCallback(() => {
    setQuizConfig((prev) => ({
      ...prev,
      note: `Quiz request: { type: ${quizConfig.type}, count: ${quizConfig.count} }`,
    }));

    if (quizConfig.type === "MCQ" || quizConfig.type === 'Both') {
      setShowQuizzPage(true);
      setShowTrueFalseQuiz(false);
    } else if (quizConfig.type === "True/False") {
      setShowQuizzPage(false);
      setShowTrueFalseQuiz(true);
    } else {
      setShowQuizzPage(false);
      setShowTrueFalseQuiz(false);
      setQuizConfig((prev) => ({
        ...prev,
        note: "Unsupported quiz type selected.",
      }));
    }
  }, [quizConfig]);

  // Update summary config
  const updateSummaryConfig = useCallback((key, value) => {
    setSummaryConfig((prev) => {
      const newConfig = { ...prev, [key]: value };

      // Special handling for scope changes
      if (key === "scope") {
        return {
          ...newConfig,
          showPageRangeInputs: value === "Page Range",
        };
      }

      return newConfig;
    });
  }, []);

  // Update quiz config
  const updateQuizConfig = useCallback((key, value) => {
    setQuizConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Update page range
  const updatePageRange = useCallback((key, value) => {
    setPageRange((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <aside ref={containerRef} className="tabs-rail" aria-label="Reader tools">
      {/* Tab navigation */}
      <nav className="tabs-bar" role="tablist" aria-orientation="horizontal">
        <TabButton
          id="summary-tab"
          label="Summarize"
          isActive={activeTab === "summary"}
          onClick={openSummary}
          title="Summarize Text"
        />

        <TabButton
          id="quizzes-tab"
          label="Quizzes"
          isActive={activeTab === "quizzes"}
          onClick={openQuizzes}
          title="Generate Quizzes"
        />

        <TabButton
          id="chat-tab"
          label="Chat"
          isActive={activeTab === "chat" && chatOpen}
          onClick={toggleChat}
          title="Chat with Book"
        />

        <span className="tabs-underline" aria-hidden />
      </nav>

      {/* Summary Panel */}
      {activeTab === "summary" && (
        <SummaryPanel
          config={summaryConfig}
          pageRange={pageRange}
          currentPage={currentPage}
          pageRanges={pageRanges}
          isLoading={isLoading}
          showSummary={showSummary}
          onClose={closeActiveTab}
          onGenerate={handleGenerateSummary}
          onConfigChange={updateSummaryConfig}
          onPageRangeChange={updatePageRange}
          onNavigateToPage={handleNavigateToPage}
        />
      )}

      {/* Quizzes Panel */}
      {activeTab === "quizzes" && (
        <QuizzesPanel
          config={quizConfig}
          setConfig={setQuizConfig}
          onClose={closeActiveTab}
          onGenerate={handleGenerateQuiz}
          onConfigChange={updateQuizConfig}
          showQuizzPage={showQuizzPage}
          showTrueFalseQuiz={showTrueFalseQuiz}
          onCloseQuiz={() => {
            setShowQuizzPage(false);
            setShowTrueFalseQuiz(false);
          }}
        />
      )}

      {/* Draggable chat */}
      <ChatWithYourBook
        endpoint={`${BACKEND_URL_Chat}/chatwithbooks`}
        open={chatOpen}
        onOpenChange={(v) => {
          setChatOpen(v);
          setActiveTab(v ? "chat" : null);
        }}
      />
    </aside>
  );
};

// Tab Button Component
const TabButton = ({ id, label, isActive, onClick, title }) => (
  <button
    id={id}
    className={`tab-pill ${isActive ? "is-active" : ""}`}
    role="tab"
    aria-selected={isActive}
    aria-controls={`${id}-panel`}
    onClick={onClick}
    title={title}
  >
    {label}
  </button>
);

// Summary Panel Component
const SummaryPanel = ({
  config,
  pageRange,
  currentPage,
  pageRanges,
  isLoading,
  showSummary,
  onClose,
  onGenerate,
  onConfigChange,
  onPageRangeChange,
  onNavigateToPage,
}) => {
  const dropdownOptions = {
    length: ["Short", "Medium", "Long"],
    mode: ["Paragraph", "Bullets"],
    tone: ["Clinical", "Layperson", "Neutral"],
    scope: ["Selection", "Current Page", "Page Range", "Entire Book"],
  };

  // Format scope options with page number only for Current Page
  const formattedScopeOptions = dropdownOptions.scope.map((option) =>
    option === "Current Page" ? `Current Page (${currentPage})` : option
  );

  return (
    <div className="glass-card" role="region" aria-labelledby="summary-tab">
      <button
        className="card-close"
        aria-label="Close summarize"
        title="Close"
        onClick={onClose}
      >
        ✕
      </button>

      <h3 className="panel-title">Generate Summary</h3>

      <Dropdown
        label="Length"
        value={config.length}
        options={dropdownOptions.length}
        onChange={(value) => onConfigChange("length", value)}
      />

      <Dropdown
        label="Mode"
        value={config.mode}
        options={dropdownOptions.mode}
        onChange={(value) => onConfigChange("mode", value)}
      />

      <Dropdown
        label="Tone"
        value={config.tone}
        options={dropdownOptions.tone}
        onChange={(value) => onConfigChange("tone", value)}
      />

      <Dropdown
        label="Scope"
        value={
          config.scope === "Current Page"
            ? `Current Page (${currentPage})`
            : config.scope
        }
        options={formattedScopeOptions}
        onChange={(value) => {
          // Extract the clean scope name without the page number
          const cleanValue = value
            .replace(/Current Page \(\d+\)/, "Current Page")
            .trim();
          onConfigChange("scope", cleanValue);
          onPageRangeChange("showInputs", cleanValue === "Page Range");
        }}
      />

      {config.scope === "Page Range" && (
        <div className="page-range-inputs">
          <div className="card-row">
            <label className="card-label">From Page:</label>
            <input
              type="number"
              min="1"
              max={pageRanges.length}
              value={pageRange.start}
              onChange={(e) =>
                onPageRangeChange("start", parseInt(e.target.value) || 1)
              }
              className="page-input"
            />
          </div>
          <div className="card-row">
            <label className="card-label">To Page:</label>
            <input
              type="number"
              min={pageRange.start}
              max={pageRanges.length}
              value={pageRange.end}
              onChange={(e) =>
                onPageRangeChange("end", parseInt(e.target.value) || 1)
              }
              className="page-input"
            />
          </div>
          <div className="page-range-info">
            Total pages: {pageRanges.length}
          </div>
        </div>
      )}

      <button
        className={`cta-primary ${isLoading ? "loading" : ""}`}
        onClick={onGenerate}
        disabled={isLoading}
      >
        {isLoading ? "Generating..." : "Generate Summary"}
      </button>

      {config.note && <p className="note">{config.note}</p>}

      {showSummary && (
        <div className="summary-result-box">
          {config.mode.toLowerCase() === "paragraph" ? (
            <ParagrapfSummary
              length={config.length}
              Summary={showSummary}
              mode={config.mode}
              onNavigateToPage={onNavigateToPage}
              isLoading={isLoading}
            />
          ) : (
            <BulletsSummary
              length={config.length}
              Summary={showSummary}
              mode={config.mode}
              isLoading={isLoading}
              onNavigateToPage={onNavigateToPage}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Tabs;

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
import useReaderToolsStore from "../../store/readerToolsStore";

const Tabs = () => {
  const containerRef = useRef(null);

  // ✅ Zustand single source of truth
  const activeTool = useReaderToolsStore((s) => s.activeTool);
  const intent = useReaderToolsStore((s) => s.intent);
  const openTool = useReaderToolsStore((s) => s.openTool);
  const closeTool = useReaderToolsStore((s) => s.closeTool);

  const [isLoading, setIsLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showQuizzPage, setShowQuizzPage] = useState(false);
  const [showTrueFalseQuiz, setShowTrueFalseQuiz] = useState(false);

  const BACKEND_URL_Summary =
    "https://immersive-reader-realtime-tts-server.onrender.com";
  const BACKEND_URL_Chat =
    "https://chat-with-your-books-server.onrender.com";

  const [summaryConfig, setSummaryConfig] = useState({
    length: "Short",
    mode: "Paragraph",
    tone: "Neutral",
    scope: "Selection",
    note: "",
  });

  const [quizConfig, setQuizConfig] = useState({
    type: "Both",
    count: 5,
    note: "",
    difficulty: "easy",
    scope: "current_page",
  });

  const [pageRange, setPageRange] = useState({
    start: 1,
    end: 1,
    showInputs: false,
  });

  const {
    selectedChunkIndex,
    currentPage,
    setCurrentPage,
    pageRanges,
    bookText,
    chunks,
  } = useBookStore();

  const chunk = useMemo(
    () => chunks[selectedChunkIndex],
    [chunks, selectedChunkIndex]
  );

  // -------- Page detection effect (unchanged) --------
  useEffect(() => {
    if (!pageRanges.length) return;

    let timeoutId;
    let observer;

    const findPDFContainer = () => {
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
      const elements = document.querySelectorAll("*");
      for (const element of elements) {
        if (element.querySelector(".react-pdf__Page")) return element;
      }
      return document;
    };

    const updateCurrentPage = () => {
      const pages = document.querySelectorAll(".react-pdf__Page");
      if (pages.length === 0) return;

      let mostVisiblePage = null;
      let maxVisibility = 0;

      pages.forEach((page) => {
        const pageNumber = parseInt(page.getAttribute("data-page-number"));
        if (!pageNumber) return;

        const rect = page.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

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
      pdfContainer.addEventListener("scroll", handleScroll);

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

      const pages = document.querySelectorAll(".react-pdf__Page");
      pages.forEach((page) => observer.observe(page));

      updateCurrentPage();

      return () => {
        pdfContainer.removeEventListener("scroll", handleScroll);
        if (observer) observer.disconnect();
      };
    };

    const initTimeout = setTimeout(setupPageDetection, 1000);

    return () => {
      clearTimeout(initTimeout);
      clearTimeout(timeoutId);
      if (observer) observer.disconnect();
    };
  }, [pageRanges, currentPage, setCurrentPage]);

  useEffect(() => {
    if (summaryConfig.scope === "Page Range" && currentPage > 0) {
      setPageRange((prev) => ({
        ...prev,
        start: currentPage,
        end: Math.min(currentPage + 1, pageRanges.length || 1),
      }));
    }
  }, [summaryConfig.scope, currentPage, pageRanges.length]);

  // -------- Helpers --------
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

  const handleNavigateToPage = useCallback(
    (referenceText) => {
      const pageMatch = referenceText.match(
        /(?:Pages?\s+)(\d+(?:\s*-\s*\d+)?)/i
      );
      if (pageMatch) {
        const pages = pageMatch[1].split(/\s*-\s*/);
        const startPage = parseInt(pages[0]);
        setCurrentPage(startPage);
        scrollToPageInViewer(startPage);
      }
    },
    [setCurrentPage, scrollToPageInViewer]
  );

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

  // -------- Summary generator (same logic as yours) --------
  const handleGenerateSummary = useCallback(async () => {
    setIsLoading(true);
    setSummaryConfig((prev) => ({ ...prev, note: "" }));

    let textForSummary = "";
    let pageInfo = null;

    try {
      switch (summaryConfig.scope) {
        case "Current Page": {
          const validPageRanges = pageRanges.filter(
            (p) => p.endIndex >= p.startIndex
          );

          const pr = validPageRanges.find((p) => p.pageNumber === currentPage);
          if (!pr) {
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

          textForSummary = bookText.slice(pr.startIndex, pr.endIndex + 1);

          pageInfo = {
            startPage: currentPage,
            endPage: currentPage,
            pages: [currentPage],
            scope: summaryConfig.scope,
            currentPage: currentPage,
          };
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
            .map((p) => bookText.slice(p.startIndex, p.endIndex + 1).trim())
            .filter(Boolean)
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
        page_info: pageInfo || { scope: summaryConfig.scope, currentPage },
        extras: { include_page_references: true },
      };

      const response = await fetch(
        `${BACKEND_URL_Summary}/api/generate_summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        setSummaryConfig((prev) => ({
          ...prev,
          note: `Error: ${data?.error || "Summary generation failed"}`,
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
    getPageRangeForChunk,
  ]);

  // -------- Quiz handler (same logic, but callable from intent) --------
  const handleGenerateQuiz = useCallback(() => {
    setQuizConfig((prev) => ({
      ...prev,
      note: `Quiz request: { type: ${quizConfig.type}, count: ${quizConfig.count} }`,
    }));

    if (quizConfig.type === "MCQ" || quizConfig.type === "Both") {
      setShowQuizzPage(true);
      setShowTrueFalseQuiz(false);
    } else if (quizConfig.type === "True/False") {
      setShowQuizzPage(false);
      setShowTrueFalseQuiz(true);
    } else {
      setShowQuizzPage(false);
      setShowTrueFalseQuiz(false);
      setQuizConfig((prev) => ({ ...prev, note: "Unsupported quiz type selected." }));
    }
  }, [quizConfig]);

  const updateSummaryConfig = useCallback((key, value) => {
    setSummaryConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateQuizConfig = useCallback((key, value) => {
    setQuizConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updatePageRange = useCallback((key, value) => {
    setPageRange((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ✅ FUNDAMENTAL: process intent reliably using nonce tracking (no clears needed)
  const processedNonceRef = useRef(null);
  useEffect(() => {
    if (!intent?.nonce) return;
    if (processedNonceRef.current === intent.nonce) return;

    processedNonceRef.current = intent.nonce;

    // If coming from bookshelf quiz action, ensure quiz UI opens
    if (intent.tool === "quizzes" && intent.action === "quiz") {
      // open quizzes tab already handled via activeTool, now open quiz UI
      handleGenerateQuiz();
    }

    // If coming from summary actions, ensure summary panel is visible (activeTool handles it)
    // If coming from chat, activeTool handles it
  }, [intent, handleGenerateQuiz]);

  // -------- UI events (tabs) --------
  const onOpenSummary = () => openTool("summary", { source: "tabs" });
  const onOpenQuizzes = () => openTool("quizzes", { source: "tabs" });
  const onToggleChat = () => {
    if (activeTool === "chat") closeTool();
    else openTool("chat", { source: "tabs" });
  };

  return (
    <aside ref={containerRef} className="tabs-rail" aria-label="Reader tools">
      <nav className="tabs-bar" role="tablist" aria-orientation="horizontal">
        <TabButton
          id="summary-tab"
          label="Summarize"
          isActive={activeTool === "summary"}
          onClick={onOpenSummary}
          title="Summarize Text"
        />

        <TabButton
          id="quizzes-tab"
          label="Quizzes"
          isActive={activeTool === "quizzes"}
          onClick={onOpenQuizzes}
          title="Generate Quizzes"
        />

        <TabButton
          id="chat-tab"
          label="Chat"
          isActive={activeTool === "chat"}
          onClick={onToggleChat}
          title="Chat with Book"
        />

        <span className="tabs-underline" aria-hidden />
      </nav>

      {activeTool === "summary" && (
        <SummaryPanel
          config={summaryConfig}
          pageRange={pageRange}
          currentPage={currentPage}
          pageRanges={pageRanges}
          isLoading={isLoading}
          showSummary={showSummary}
          onClose={closeTool}
          onGenerate={handleGenerateSummary}
          onConfigChange={updateSummaryConfig}
          onPageRangeChange={updatePageRange}
          onNavigateToPage={handleNavigateToPage}
        />
      )}

      {activeTool === "quizzes" && (
        <QuizzesPanel
          config={quizConfig}
          setConfig={setQuizConfig}
          onClose={closeTool}
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

      <ChatWithYourBook
        endpoint={`${BACKEND_URL_Chat}/chatwithbooks`}
        open={activeTool === "chat"}
        onOpenChange={(v) => {
          if (v) openTool("chat", { source: "chat" });
          else closeTool();
        }}
      />
    </aside>
  );
};

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

  const formattedScopeOptions = dropdownOptions.scope.map((option) =>
    option === "Current Page" ? `Current Page (${currentPage})` : option
  );

  return (
    <div className="glass-card" role="region" aria-labelledby="summary-tab">
      <div className="crose-box">
        <h3 className="panel-title">Generate Summary</h3>
        <button className="card-close" aria-label="Close" title="Close" onClick={onClose}>
          ✕
        </button>
      </div>

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
              onChange={(e) => onPageRangeChange("start", parseInt(e.target.value) || 1)}
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
              onChange={(e) => onPageRangeChange("end", parseInt(e.target.value) || 1)}
              className="page-input"
            />
          </div>
          <div className="page-range-info">Total pages: {pageRanges.length}</div>
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


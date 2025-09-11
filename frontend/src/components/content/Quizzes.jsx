/* eslint-disable no-unused-vars */
import { useState } from "react";
import McqQuiz from "./McqQuiz";
import TrueFalseQuiz from "./TrueFalseQuiz";
import useBookStore from "../../store/bookStore";
import '../../styles/Summary/ReaderQuiz.css'

// Quizzes Panel Component
const QuizzesPanel = ({
  config,
  setConfig,
  onClose,
  onGenerate,
  onConfigChange,
  showQuizzPage,
  showTrueFalseQuiz,
  onCloseQuiz,
}) => {
  const [quizData, setQuizData] = useState([]);
  const [pageRange, setPageRange] = useState({ start: 1, end: 1 });
  const [isLoading, setIsLoading] = useState(false);
const [error, setError]=useState(null)
const [content, setContent]= useState("")
  const { bookText, currentPage, pageRanges } = useBookStore();
 /** ✅ Validation helper */
  const validateConfig = () => {
    if (!config.type) return "Please select a question type.";
    if (!config.difficulty) return "Please select a difficulty.";
    if (!config.count || config.count <= 0) return "Please select number of questions.";
    if (!config.scope) return "Please select a scope.";

    if (config.scope === "page_range") {
      if (!pageRange.start || !pageRange.end) return "Please enter a valid page range.";
      if (pageRange.start > pageRange.end) return "Start page cannot be greater than end page.";
      if (pageRange.end > (pageRanges?.length || 1)) return "Page range exceeds total number of pages.";
    }

    return null; // valid
  };
  const extractText = () => {
    let textForQuiz = "";
    let pageInfo = {};
    switch (config.scope) {
      case "current_page": {
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
          setConfig((prev) => ({
            ...prev,
            note: `No valid data found for page ${currentPage}. Available pages: ${availablePages}`,
          }));
          setIsLoading(false);
          return;
        }

        textForQuiz = bookText.slice(
          pageRange.startIndex,
          pageRange.endIndex + 1
        );

        pageInfo = {
          startPage: currentPage,
          endPage: currentPage,
          pages: [currentPage],
          scope: config.scope,
          currentPage: currentPage,
        };

        // If current page has minimal content, include adjacent pages
        if (textForQuiz.trim().length < 50) {
          const adjacentPages = validPageRanges
            .filter((p) => Math.abs(p.pageNumber - currentPage) <= 1)
            .slice(0, 3);

          if (adjacentPages.length > 0) {
            textForQuiz = adjacentPages
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
              scope: config.scope,
              currentPage: currentPage,
            };
          }
        }
        break;
      }

      case "page_range": {
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
          setConfig((prev) => ({
            ...prev,
            note: "No valid pages found in the specified range.",
          }));
          setIsLoading(false);
          return;
        }

        textForQuiz = pagesInRange
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
          scope: config.scope,
          currentPage: currentPage,
          customRange: { start: pageRange.start, end: pageRange.end },
        };

        break;
      }

      case "entire_book":
        textForQuiz = bookText;
        break;

      default:
        textForQuiz = bookText;
    }

    return textForQuiz;
  };

  const handleGenerate = async () => {
        setError(null);

    const configError = validateConfig();
    if (configError) {
      setError(configError);
      return;
    }

    setIsLoading(true)
    const refrenceText = extractText();
    if (!refrenceText || refrenceText.trim() === "") {
      setError("Reference text can't be empty.");
      setIsLoading(false);
      return;
    }
    if (refrenceText.length <= 50) {
      setError("Reference text too short, consider adding more pages.");
      setIsLoading(false);
      return;
    }

    setContent(refrenceText)
  
    try {
      let endpoint = `http://127.0.0.1:5003/generate`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: refrenceText,
          quiz_type: config.type,
          count: config.count,
          difficulty: config.difficulty || "medium",
          scope: config.scope || "entire_book",
          page_range: config.scope === "page_range" ? pageRange : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to load questions");

      const data = await res.json();
      if (data.questions) {
        setQuizData(data.questions);
        onGenerate();
      } else {
        setError("No questions returned from server.");
      }
    } catch (err) {
      console.error("Error generating quiz:", err);
      setError(err.message || "Unexpected error while generating quiz.");
    } finally {
      setIsLoading(false);
    }
  };

  const onPageRangeChange = (field, value) => {
    setPageRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="glass-card" role="region" aria-labelledby="quizzes-tab">
      <button
        className="card-close"
        aria-label="Close quizzes"
        title="Close"
        onClick={onClose}
      >
        ✕
      </button>

      <h3 className="panel-title">Generate Quiz</h3>

      {/* Question Type */}
      <div className="card-row">
        <span className="card-label">Question Type</span>
        <div className="segmented wrap">
          {["MCQ", "True/False", "Both"].map((type) => (
            <button
              key={type}
              className={`seg-btn ${config.type === type ? "is-active" : ""}`}
              aria-pressed={config.type === type}
              onClick={() => onConfigChange("type", type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Difficulty */}
      <div className="card-row">
        <span className="card-label">Difficulty</span>
        <div className="segmented wrap">
          {["easy", "medium", "hard"].map((lvl) => (
            <button
              key={lvl}
              className={`seg-btn ${
                config.difficulty === lvl ? "is-active" : ""
              }`}
              aria-pressed={config.difficulty === lvl}
              onClick={() => onConfigChange("difficulty", lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Scope */}
      <div className="card-row">
        <span className="card-label">Scope</span>
        <div className="segmented wrap">
          {[
            `current_page`,
            "page_range",
            "entire_book",
          ].map((sc) => (
            <button
              key={sc}
              className={`seg-btn ${config.scope === sc ? "is-active" : ""}`}
              aria-pressed={config.scope === sc}
              onClick={() => onConfigChange("scope", sc)}
            >
              {sc.replace("_", " ")} {sc==='current_page'&&`(Page no: ${currentPage})`}
            </button>
          ))}
        </div>
      </div>

      {/* Page Range Inputs */}
      {config.scope === "page_range" && (
        <div className="page-range-inputs">
          <div className="page-range-row">
            <div className="card-row">
              <label className="card-label">From</label>
              <input
                type="number"
                min="1"
                max={pageRanges?.length || 1}
                value={pageRange.start}
                onChange={(e) =>
                  onPageRangeChange("start", parseInt(e.target.value))
                }
                className="page-input"
              />
            </div>
            <span className="range-separator">—</span>
            <div className="card-row">
              <label className="card-label">To</label>
              <input
                type="number"
                min={pageRange.start}
                max={pageRanges?.length || 1}
                value={pageRange.end}
                onChange={(e) =>
                  onPageRangeChange("end", parseInt(e.target.value))
                }
                className="page-input"
              />
            </div>
          </div>
          <div className="page-range-info">
            Total pages: {pageRanges?.length || 0}
          </div>
        </div>
      )}

      {/* Count */}
      <div className="card-row">
        <span className="card-label">Number of Questions</span>
        <div className="segmented wrap">
          {[5, 10, 15, 20].map((n) => (
            <button
              key={n}
              className={`seg-btn ${config.count === n ? "is-active" : ""}`}
              aria-pressed={config.count === n}
              onClick={() => onConfigChange("count", n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <button className="cta-primary" onClick={handleGenerate}>
        {isLoading?"Generating...":"Generate Quiz"}
      </button>
     {/* ✅ Error display */}
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {(showQuizzPage || showTrueFalseQuiz) && (
        <QuizModal
          isOpen={showQuizzPage || showTrueFalseQuiz}
          onClose={onCloseQuiz}
        >
          {showQuizzPage ? (
            <McqQuiz quizData={quizData} referenceText={content} />
          ) : (
            <TrueFalseQuiz quizData={quizData} referenceText={content} />
          )}
        </QuizModal>
      )}
    </div>
  );
};

// Quiz Modal Component
const QuizModal = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="Close quiz"
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
};

export default QuizzesPanel;
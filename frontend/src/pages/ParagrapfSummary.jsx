import useBookStore from "../store/bookStore";

export default function ParagrapfSummary({ 
  length = "short", 
  Summary,
  isLoading
}) {
  const selected = length.toLowerCase();
  const setGoToPage = useBookStore((state) => state.setGoToPage);

  // Don't render anything while loading
  if (isLoading) return null;

  // Don't render if summary is missing
  if (!Summary || !Summary[selected]) return null;

  console.log(Summary.source_reference, "====source");

  // Helper: get first page number from reference (e.g., "2-5" -> 2)
  const getFirstPage = (ref) => {
    if (!ref) return null;
    const parts = ref.split("-");
    return Number(parts[0]); // always take the first number
  };

  return (
    <div className="paragraph-summary">
      <div className="summary-text">
        <p>{Summary[selected]}</p>
      </div>
      
      {Summary.source_reference && Summary.source_reference !== "0" && (
        <div className="source-reference mt-10">
          <a
            href={`#${Summary.source_reference}`} 
            onClick={(e) => {
              e.preventDefault();
              const firstPage = getFirstPage(Summary.source_reference);
              if (!isNaN(firstPage)) {
                setGoToPage(firstPage);
              }
            }}
            className="page-reference-link text-blue-600 underline cursor-pointer"
            title={`Jump to ${Summary.source_reference}`}
          >
            Source Reference: {Summary.source_reference}
          </a>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback } from "react";

/**
 * Hook for streaming IVF quiz questions with live typing effect.
 */
export default function useLiveQuiz() {
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [streamingQuestion, setStreamingQuestion] = useState(""); // NEW!

  const startQuiz = useCallback(async (difficulty) => {
    setQuestions([]);
    setError("");
    setSessionId(null);
    setStreamingQuestion("");

    const response = await fetch(
      "https://ivf-backend-server.onrender.com/start-quiz",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "IVF", difficulty }),
      }
    );

    if (!response.ok) {
      setError(`Server error: ${response.statusText}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.replace("data: ", "").trim();

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.error) {
              console.error("Stream error:", parsed.error);
              setError(parsed.error);
            } else {
              // Full questions array fallback
              if (parsed.questions && Array.isArray(parsed.questions)) {
                setQuestions(parsed.questions);
                setSessionId(parsed.session_id);
                setStreamingQuestion("");
              } else {
                // Finalize question
                setQuestions((prev) => [...prev, parsed]);
                setStreamingQuestion(""); // Clear after finalizing
              }
            }

          } catch {
            // If not fully parsable, show partial text for live typing
            setStreamingQuestion(jsonStr);
          }
        }
      }
    }

    // Parse leftover if any
    if (buffer.trim().startsWith("data: ")) {
      const jsonStr = buffer.replace("data: ", "").trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          setQuestions(parsed.questions);
        } else {
          setQuestions((prev) => [...prev, parsed]);
        }
      } catch {
        setStreamingQuestion(jsonStr);
      }
    }

  }, []);

  return {
    questions,
    error,
    sessionId,
    startQuiz,
    streamingQuestion, // EXPOSED!
    setQuestions,
    setError,
  };
}


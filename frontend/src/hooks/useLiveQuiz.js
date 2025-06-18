import { useState, useCallback } from "react";

/**
 * Hook for streaming IVF quiz questions using SSE style.
 * Handles partial text for typing + final parsed JSON.
 */
export default function useLiveQuiz() {
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [streamingQuestion, setStreamingQuestion] = useState(""); // partial text

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
              setError(parsed.error);
            } else if (parsed.questions && Array.isArray(parsed.questions)) {
              setQuestions(parsed.questions);
              if (parsed.session_id) {
                setSessionId(parsed.session_id);
              }
              setStreamingQuestion("");
            } else {
              // ✅ Final parsed question → push + clear stream text
              setQuestions((prev) => [...prev, parsed]);
              setStreamingQuestion("");
            }

          } catch {
            // Not JSON yet? treat as partial stream text
            setStreamingQuestion(jsonStr);
          }
        }
      }
    }

    // Parse leftover buffer
    if (buffer.trim().startsWith("data: ")) {
      const jsonStr = buffer.replace("data: ", "").trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          setQuestions(parsed.questions);
        } else {
          setQuestions((prev) => [...prev, parsed]);
        }
        setStreamingQuestion("");
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
    streamingQuestion, // expose for live typing
    setQuestions,
    setError,
  };
}


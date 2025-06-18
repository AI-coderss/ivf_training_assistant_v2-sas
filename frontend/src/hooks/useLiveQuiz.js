import { useState, useCallback } from "react";

/**
 * Custom hook for streaming IVF quiz questions using POST + ReadableStream.
 */
export default function useLiveQuiz() {
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState(null);

  const startQuiz = useCallback(async (difficulty) => {
    setQuestions([]);
    setError("");
    setSessionId(null);

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
    }

    buffer += decoder.decode();

    try {
      const parsed = JSON.parse(buffer);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        setQuestions(parsed.questions);
        setSessionId(parsed.session_id);
      } else {
        setError("Invalid quiz format.");
      }
    } catch (err) {
      console.error("Parse error:", err);
      setError("Failed to parse streamed quiz.");
    }
  }, []);

  return {
    questions,
    error,
    sessionId,
    startQuiz,
    setQuestions,
    setError,
  };
}

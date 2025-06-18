import { useState, useCallback } from "react";

/**
 * Custom hook for streaming IVF quiz questions using POST + ReadableStream,
 * handles SSE-style `data:` chunks properly.
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

      // Decode incoming chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Split by double newline (SSE delimiter)
      let lines = buffer.split("\n\n");

      // Keep incomplete piece for next round
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
              // Fallback if entire questions array comes at once
              if (parsed.questions && Array.isArray(parsed.questions)) {
                setQuestions(parsed.questions);
                if (parsed.session_id) {
                  setSessionId(parsed.session_id);
                }
              } else {
                // Otherwise, it's a single streamed question object
                setQuestions((prev) => [...prev, parsed]);
              }
            }

          } catch (err) {
            console.error("Parse error:", err, jsonStr);
          }
        }
      }
    }

    // After stream ends, parse leftover buffer if needed
    if (buffer.trim().startsWith("data: ")) {
      const jsonStr = buffer.replace("data: ", "").trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          setQuestions(parsed.questions);
        } else {
          setQuestions((prev) => [...prev, parsed]);
        }
      } catch (err) {
        console.error("Parse error in leftover:", err, jsonStr);
      }
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


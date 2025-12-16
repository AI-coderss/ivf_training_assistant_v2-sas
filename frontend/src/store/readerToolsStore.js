// src/store/readerToolsStore.js
import { create } from "zustand";

/**
 * Single source of truth for tools UI state.
 * BookShelf and Tabs both use this store.
 *
 * activeTool: null | "summary" | "quizzes" | "chat"
 * intent: { tool, action, book, source, nonce }
 */
const useReaderToolsStore = create((set) => ({
  activeTool: null,
  intent: null,

  openTool: (tool, payload = {}) =>
    set({
      activeTool: tool,
      intent: {
        tool,
        action: payload.action || null, // "summarize" | "explain" | "quiz" | "ask" | null
        book: payload.book || null, // {id,title,url}
        source: payload.source || "unknown", // "bookshelf" | "tabs"
        nonce: Date.now(), // ensures effects always trigger
      },
    }),

  closeTool: () =>
    set({
      activeTool: null,
      intent: { tool: null, action: "close", book: null, source: "tabs", nonce: Date.now() },
    }),
}));

export default useReaderToolsStore;


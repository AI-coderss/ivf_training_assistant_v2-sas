import { create } from "zustand";

const useBookStore = create((set) => ({
    chunks: [],
    setChunks: (newChunks) => set({ chunks: newChunks }),
    selectedChunkIndex: 0,
    setSelectedChunkIndex: (index) => set({ selectedChunkIndex: index }),
    bookText: "",
    setBookText: (text) => set({ bookText: text }),
    selectedTextInfo: {
        text: "",
        pageNumber: 0,
        startIndex: 0,
        endIndex: 0,
        itemIndex: 0,
    },
    setSelectedTextInfo: ({ text, pageNumber, startIndex, endIndex, itemIndex }) => set({
        selectedTextInfo: {
            text,
            pageNumber,
            startIndex,
            endIndex,
            itemIndex
        },
    }),

    markedText: "",
    setMarkedText: (text) => set({ markedText: text }),
    highlightedWordIndex: 0,
    setHighlightedWordIndex: (index) => set({ highlightedWordIndex: index }),

    isAutoScrolling: false,
    setIsAutoScrolling: (isAutoScrolling) => set({ isAutoScrolling }),

    isReaderMode: false,
    setIsReaderMode: (isReaderMode) => set({ isReaderMode }),

    isPlaying: false,
    setIsPlaying: (isPlaying) => set({ isPlaying }),


    // for mobile view
    currentPage: 1,
    setCurrentPage: (page) => set({ currentPage: page }),
}))

export default useBookStore;
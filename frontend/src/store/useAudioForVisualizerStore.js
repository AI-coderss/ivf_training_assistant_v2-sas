import { create } from 'zustand';

const useAudioForVisualizerStore = create((set) => ({
  audioStream: null,         // For live MediaStream (WebRTC)
  setAudioStream: (stream) => set({ audioStream: stream }),
  clearAudioStream: () => set({ audioStream: null }),

  audioUrl: null,            // Optional: fallback audio URL
  setAudioUrl: (url) => set({ audioUrl: url }),
  clearAudioUrl: () => set({ audioUrl: null }),

  isVisualizerReady: false,  // Optional: control flag
  setVisualizerReady: (ready) => set({ isVisualizerReady: ready }),
}));

export default useAudioForVisualizerStore;
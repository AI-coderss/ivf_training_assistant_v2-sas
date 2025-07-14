import { create } from 'zustand';

const useAudioForVisualizerStore = create((set) => ({
  audioUrl: null,
  setAudioUrl: (url) => set({ audioUrl: url }),
  clearAudioUrl: () => set({ audioUrl: null }),
}));

export default useAudioForVisualizerStore;

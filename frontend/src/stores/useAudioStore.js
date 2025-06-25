import { create } from "zustand";

const useAudioStore = create((set, get) => ({
    // --- STATE ---
    tracks: [],
    currentTrackIndex: null,
    isPlaying: false,
    audio: typeof window !== "undefined" ? new Audio() : undefined,
    audioContext: undefined,
    analyserNode: undefined,
    volume: 1,
    currentTime: 0,
    duration: 0,
    isShuffle: false,
    isLiked: [],

    // --- ACTIONS ---
    setTracks: (tracks) => {
        const { audio } = get();
        set({
            tracks,
            isLiked: Array(tracks.length).fill(false)
        });
        if (audio && get().currentTrackIndex === null && tracks.length > 0) {
            audio.src = tracks[0].url;
            audio.crossOrigin = "anonymous"; // Essential for visualizer
            set({ currentTrackIndex: 0 });
        }
    },

    _initVisualizer: () => {
        const { audio, audioContext } = get();
        if (audioContext || !audio) return;

        const newAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const newAnalyserNode = newAudioContext.createAnalyser();
        newAnalyserNode.fftSize = 256;

        const source = newAudioContext.createMediaElementSource(audio);
        source.connect(newAnalyserNode);
        newAnalyserNode.connect(newAudioContext.destination);

        set({ audioContext: newAudioContext, analyserNode: newAnalyserNode });
    },
    
    playTrack: (index) => {
        const { audio, tracks, currentTrackIndex, audioContext } = get();
        if (!tracks || index < 0 || index >= tracks.length) return;

        if (!audioContext) get()._initVisualizer();
        
        if (index !== currentTrackIndex) {
            set({ currentTrackIndex: index, currentTime: 0 });
            audio.src = tracks[index].url;
            audio.crossOrigin = "anonymous";
        }
        
        audio.play().catch(e => console.error("Audio play failed. User interaction may be required.", e));
    },
    
    playPause: () => {
        const { audio, isPlaying, audioContext, tracks, currentTrackIndex } = get();
        if (!audio.src && tracks.length > 0) {
            get().playTrack(currentTrackIndex ?? 0);
            return;
        }
        
        if (isPlaying) {
            audio.pause();
        } else {
            if (!audioContext) get()._initVisualizer();
            audio.play().catch(e => console.error("Audio play failed:", e));
        }
    },

    nextTrack: () => {
        const { tracks, currentTrackIndex, isShuffle } = get();
        if (tracks.length === 0) return;
        const nextIndex = isShuffle
          ? Math.floor(Math.random() * tracks.length)
          : ((currentTrackIndex ?? -1) + 1) % tracks.length;
        get().playTrack(nextIndex);
    },

    prevTrack: () => {
        const { tracks, currentTrackIndex } = get();
        if (tracks.length === 0) return;
        const prevIndex = ((currentTrackIndex ?? 0) - 1 + tracks.length) % tracks.length;
        get().playTrack(prevIndex);
    },
    
    _initEventListeners: () => {
        const { audio } = get();
        if (!audio) return;

        audio.addEventListener('timeupdate', () => set({ currentTime: audio.currentTime }));
        audio.addEventListener('loadedmetadata', () => set({ duration: audio.duration }));
        audio.addEventListener('ended', () => get().nextTrack());
        audio.addEventListener('play', () => set({ isPlaying: true }));
        audio.addEventListener('pause', () => set({ isPlaying: false }));
    },
    
    setVolume: (volume) => {
        const { audio } = get();
        if(audio) audio.volume = volume;
        set({ volume });
    },

    seek: (time) => {
        const { audio } = get();
        if(audio) audio.currentTime = time;
        set({ currentTime: time });
    },

    toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
}));

if (typeof window !== "undefined") {
    useAudioStore.getState()._initEventListeners();
}

export default useAudioStore;
import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

interface Beat {
  id: string
  title: string
  producer_name: string
  cover_url: string
  mp3_preview_url: string
}

interface PlayerState {
  queue: Beat[]
  currentIndex: number
  currentBeat: Beat | null
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  
  // Actions
  addToQueue: (beat: Beat) => void
  setQueue: (beats: Beat[]) => void
  skipNext: () => void
  skipPrev: () => void
  setBeat: (beat: Beat) => void
  togglePlay: () => void
  setPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setProgress: (time: number, duration: number) => void
  incrementPlay: (beatId: string) => Promise<{ error: any }>
}

const supabase = createClient()

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  currentBeat: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,

  addToQueue: (beat) => set((state) => ({ queue: [...state.queue, beat] })),
  setQueue: (beats) => set({ queue: beats, currentIndex: beats.length > 0 ? 0 : -1, currentBeat: beats.length > 0 ? beats[0] : null }),
  skipNext: () => set((state) => {
    if (state.currentIndex < state.queue.length - 1) {
      const newIndex = state.currentIndex + 1
      return { currentIndex: newIndex, currentBeat: state.queue[newIndex] }
    }
    return state
  }),
  skipPrev: () => set((state) => {
    if (state.currentIndex > 0) {
      const newIndex = state.currentIndex - 1
      return { currentIndex: newIndex, currentBeat: state.queue[newIndex] }
    }
    return state
  }),
  setBeat: (beat) => set({ currentBeat: beat, isPlaying: true }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setProgress: (time, duration) => set({ currentTime: time, duration }),
  incrementPlay: async (beatId) => {
    return await supabase.rpc('increment_beat_play_count', { beat_id: beatId })
  },
}))

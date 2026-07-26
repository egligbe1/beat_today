import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { PlayerBeat as Beat } from '@/lib/types'

type RepeatMode = 'off' | 'one' | 'all'

interface PlayerState {
  queue: Beat[]
  currentIndex: number
  currentBeat: Beat | null
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  repeat: RepeatMode
  shuffle: boolean

  // Actions
  addToQueue: (beat: Beat) => void
  setQueue: (beats: Beat[]) => void
  skipNext: () => boolean
  skipPrev: () => void
  setBeat: (beat: Beat) => void
  closePlayer: () => void
  togglePlay: () => void
  setPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setProgress: (time: number, duration: number) => void
  cycleRepeat: () => void
  toggleShuffle: () => void
  incrementPlay: (beatId: string) => Promise<{ error: any }>
}

// Pick a "random" index in [0, len) that isn't `exclude` (when possible) by
// stepping a non-zero offset so we never land back on the current track.
function randomIndex(len: number, exclude: number): number {
  if (len <= 1) return 0
  const offset = 1 + Math.floor(Math.random() * (len - 1))
  return (exclude + offset) % len
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  currentBeat: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  repeat: 'off',
  shuffle: false,

  addToQueue: (beat) => set((state) => ({ queue: [...state.queue, beat] })),
  setQueue: (beats) => set({
    queue: beats,
    currentIndex: beats.length > 0 ? 0 : -1,
    currentBeat: beats.length > 0 ? beats[0] : null,
  }),

  // Returns true if it actually advanced (used by the "track finished" handler
  // to decide whether to stop or move on). Honors shuffle and repeat === 'all'.
  skipNext: () => {
    const state = get()
    const { queue, currentIndex, shuffle, repeat } = state
    if (queue.length === 0) return false

    let newIndex: number
    if (shuffle && queue.length > 1) {
      newIndex = randomIndex(queue.length, currentIndex)
    } else if (currentIndex < queue.length - 1) {
      newIndex = currentIndex + 1
    } else if (repeat === 'all') {
      newIndex = 0 // wrap around
    } else {
      return false // at the end, no repeat
    }

    set({ currentIndex: newIndex, currentBeat: queue[newIndex], isPlaying: true })
    return true
  },

  skipPrev: () => set((state) => {
    if (state.queue.length === 0) return state
    if (state.currentIndex > 0) {
      const newIndex = state.currentIndex - 1
      return { currentIndex: newIndex, currentBeat: state.queue[newIndex] }
    }
    // At the start: wrap to the end when repeating all, otherwise stay.
    if (state.repeat === 'all') {
      const newIndex = state.queue.length - 1
      return { currentIndex: newIndex, currentBeat: state.queue[newIndex] }
    }
    return state
  }),

  setBeat: (beat) => set({ currentBeat: beat, isPlaying: true }),
  closePlayer: () => set({ currentBeat: null, isPlaying: false, currentTime: 0, duration: 0 }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setProgress: (time, duration) => set({ currentTime: time, duration }),
  cycleRepeat: () => set((state) => ({
    repeat: state.repeat === 'off' ? 'one' : state.repeat === 'one' ? 'all' : 'off',
  })),
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),

  incrementPlay: async (beatId) => {
    // Lazily create the client so importing the store doesn't spin one up
    // during SSR/bundle evaluation.
    const supabase = createClient()
    return await supabase.rpc('increment_beat_play_count', { beat_id: beatId })
  },
}))

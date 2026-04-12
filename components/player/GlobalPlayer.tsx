'use client'

import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, X, Music, Repeat, Repeat1, Shuffle, ChevronUp } from 'lucide-react'
import { usePlayerStore } from '@/lib/stores/playerStore'
import Image from 'next/image'
import { cn, formatTime } from '@/lib/utils'

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export default function GlobalPlayer() {
  const { currentBeat, isPlaying, togglePlay, setPlaying, volume, setVolume, setProgress, skipNext, skipPrev, currentTime, duration, queue } = usePlayerStore()
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurfer = useRef<WaveSurfer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [repeat, setRepeat] = useState<'off' | 'one' | 'all'>('off')
  const [shuffle, setShuffle] = useState(false)
  const [muted, setMuted] = useState(false)
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const prevVolume = useRef(volume)

  useEffect(() => {
    if (!waveformRef.current || !currentBeat?.mp3_preview_url) return
    if (wavesurfer.current) wavesurfer.current.destroy()

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#3A3A3A',
      progressColor: '#FF5500',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 3,
      height: 36,
      normalize: true,
    })

    wavesurfer.current.load(currentBeat.mp3_preview_url)
    wavesurfer.current.on('ready', () => {
      setIsReady(true)
      wavesurfer.current?.setPlaybackRate(speed)
      if (isPlaying) wavesurfer.current?.play()
    })
    wavesurfer.current.on('audioprocess', () => {
      if (wavesurfer.current) setProgress(wavesurfer.current.getCurrentTime(), wavesurfer.current.getDuration())
    })
    wavesurfer.current.on('finish', () => {
      if (repeat === 'one') {
        wavesurfer.current?.seekTo(0)
        wavesurfer.current?.play()
      } else if (repeat === 'all' || queue.length > 1) {
        skipNext()
      } else {
        setPlaying(false)
      }
    })

    return () => { wavesurfer.current?.destroy() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBeat])

  // Handle window resize to redraw waveform
  useEffect(() => {
    const handleResize = () => {
      if (wavesurfer.current && isReady) {
        // WaveSurfer v7 handles resizing automatically/differently
        // and does not have a manual .draw() method.
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isReady])

  const lastTrackedBeatId = useRef<string | null>(null)
  const playTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (wavesurfer.current && isReady) {
      if (isPlaying) {
        wavesurfer.current.play()
        if (currentBeat && currentBeat.id !== lastTrackedBeatId.current) {
          if (playTimer.current) clearTimeout(playTimer.current)
          playTimer.current = setTimeout(async () => {
            const { error } = await usePlayerStore.getState().incrementPlay(currentBeat.id)
            if (!error) lastTrackedBeatId.current = currentBeat.id
          }, 3000)
        }
      } else {
        wavesurfer.current.pause()
        if (playTimer.current) { clearTimeout(playTimer.current); playTimer.current = null }
      }
    }
  }, [isPlaying, isReady, currentBeat])

  useEffect(() => {
    if (wavesurfer.current) wavesurfer.current.setVolume(muted ? 0 : volume)
  }, [volume, muted])

  useEffect(() => {
    if (wavesurfer.current && isReady) wavesurfer.current.setPlaybackRate(speed)
  }, [speed, isReady])

  const cycleRepeat = () => setRepeat(r => r === 'off' ? 'one' : r === 'one' ? 'all' : 'off')
  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(speed)
    setSpeed(SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length])
  }
  const toggleMute = () => {
    if (!muted) prevVolume.current = volume
    else setVolume(prevVolume.current || 0.8)
    setMuted(m => !m)
  }
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    wavesurfer.current?.seekTo(Math.min(1, Math.max(0, percent)))
  }

  if (!currentBeat?.mp3_preview_url) return null

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  return (
    <>
      {/* ─── MOBILE PLAYER ─────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[90] animate-slide-up">
        <div className="bg-[#111]/95 backdrop-blur-2xl border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.9)]">

          {/* Expanded panel: secondary controls */}
          {mobileExpanded && (
            <div className="px-5 pt-4 pb-3 border-b border-white/5 space-y-3">
              {/* Waveform */}
              <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                <span className="text-[10px] text-text-muted font-mono w-8 text-right flex-shrink-0">
                  {formatTime(currentTime)}
                </span>
                <div className="relative flex-1 h-9 cursor-pointer" onClick={handleSeek}>
                  <div ref={waveformRef} className="absolute inset-0" />
                </div>
                <span className="text-[10px] text-text-muted font-mono w-8 flex-shrink-0">
                  {formatTime(duration)}
                </span>
              </div>
              {/* Secondary controls row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShuffle(s => !s)}
                    className={cn('w-10 h-10 flex items-center justify-center rounded-xl transition-colors', shuffle ? 'text-[#FF5500] bg-[#FF5500]/10' : 'text-text-muted')}
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cycleRepeat}
                    className={cn('w-10 h-10 flex items-center justify-center rounded-xl transition-colors', repeat !== 'off' ? 'text-[#FF5500] bg-[#FF5500]/10' : 'text-text-muted')}
                  >
                    {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={cycleSpeed}
                    className={cn(
                      'h-8 px-2.5 rounded-lg text-[11px] font-black border transition-colors',
                      speed !== 1 ? 'text-[#FF5500] border-[#FF5500]/30 bg-[#FF5500]/10' : 'text-text-muted border-white/10'
                    )}
                  >
                    {speed}x
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleMute} className="text-text-muted w-10 h-10 flex items-center justify-center">
                    {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={muted ? 0 : volume}
                    onChange={(e) => { setMuted(false); setVolume(parseFloat(e.target.value)) }}
                    className="w-24 h-1 accent-[#FF5500] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Thin seekable progress line */}
          <div className="h-[2px] bg-white/10 cursor-pointer relative" onClick={handleSeek}>
            <div
              className="h-full bg-gradient-to-r from-[#FF5500] to-[#FFB000] transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Main control row */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {/* Cover art */}
            <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-bg-elevated flex-shrink-0 shadow-lg border border-white/5">
              {currentBeat.cover_url ? (
                <Image src={currentBeat.cover_url} alt={currentBeat.title} fill className="object-cover" />
              ) : (
                <Music className="w-5 h-5 text-text-muted m-auto absolute inset-0" />
              )}
            </div>

            {/* Title + expand toggle */}
            <button
              onClick={() => setMobileExpanded(e => !e)}
              className="flex-1 min-w-0 text-left flex items-center gap-2 py-1"
            >
              <div className="min-w-0 flex-1">
                <p className="font-black text-white text-sm truncate leading-tight">{currentBeat.title}</p>
                <p className="text-[11px] text-text-muted truncate mt-0.5">{currentBeat.producer_name}</p>
              </div>
              <ChevronUp
                className={cn('w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200', mobileExpanded ? 'rotate-180' : '')}
              />
            </button>

            {/* Playback buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={skipPrev}
                className="w-9 h-9 flex items-center justify-center text-text-muted active:text-white active:scale-90 transition-all"
              >
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={togglePlay}
                className="w-13 h-13 w-[52px] h-[52px] bg-[#FF5500] rounded-full flex items-center justify-center shadow-[0_0_24px_rgba(255,85,0,0.5)] active:scale-95 transition-transform"
              >
                {isPlaying
                  ? <Pause className="w-5 h-5 fill-current text-white" />
                  : <Play className="w-5 h-5 fill-current text-white ml-0.5" />
                }
              </button>
              <button
                onClick={skipNext}
                className="w-9 h-9 flex items-center justify-center text-text-muted active:text-white active:scale-90 transition-all"
              >
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={() => usePlayerStore.getState().setBeat(null as any)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-text-muted active:text-white ml-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── DESKTOP PLAYER ────────────────────────────────────── */}
      <div className="hidden md:flex fixed bottom-6 left-0 right-0 justify-center z-[90] pointer-events-none px-4">
        <div className="w-full max-w-5xl pointer-events-auto animate-slide-up">
          <div className="bg-bg-surface/90 backdrop-blur-2xl border border-white/10 rounded-[28px] h-[72px] px-3 flex items-center justify-between shadow-[0_30px_60px_rgba(0,0,0,0.8)] gap-3">

          {/* Beat Info */}
          <div className="flex items-center gap-3 w-40 lg:w-[200px] flex-shrink-0">
            <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-bg-elevated flex-shrink-0 shadow-lg border border-white/5">
              {currentBeat.cover_url ? (
                <Image src={currentBeat.cover_url} alt={currentBeat.title} fill className="object-cover" />
              ) : (
                <Music className="w-5 h-5 text-text-muted m-auto absolute inset-0" />
              )}
            </div>
            <div className="overflow-hidden min-w-0">
              <h4 className="font-black text-white text-[13px] truncate uppercase tracking-tight leading-tight">{currentBeat.title}</h4>
              <p className="text-[10px] text-text-muted font-bold tracking-widest uppercase truncate">{currentBeat.producer_name}</p>
            </div>
          </div>

          {/* Center: Controls + Waveform */}
          <div className="flex items-center flex-1 gap-3 min-w-0">
            {/* Playback controls */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShuffle(s => !s)}
                className={cn('w-8 h-8 flex items-center justify-center rounded-lg transition-colors', shuffle ? 'text-[#FF5500]' : 'text-text-muted hover:text-white')}
              >
                <Shuffle className="w-3.5 h-3.5" />
              </button>
              <button onClick={skipPrev} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors">
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={togglePlay}
                className="bg-[#FF5500] text-white w-11 h-11 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,85,0,0.4)] flex-shrink-0"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button onClick={skipNext} className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-white transition-colors">
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={cycleRepeat}
                className={cn('w-8 h-8 flex items-center justify-center rounded-lg transition-colors', repeat !== 'off' ? 'text-[#FF5500]' : 'text-text-muted hover:text-white')}
              >
                {repeat === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Waveform */}
            <div className="flex-1 flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 h-11 border border-white/5 min-w-0 cursor-pointer" onClick={handleSeek}>
              <span className="text-[10px] text-text-muted font-black w-8 text-right font-mono flex-shrink-0">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex-1 h-full min-w-0">
                <div ref={waveformRef} className="absolute inset-0" />
              </div>
              <span className="text-[10px] text-text-muted font-black w-8 font-mono flex-shrink-0">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={cycleSpeed}
              className={cn(
                'hidden xl:block h-7 px-2 rounded-lg text-[10px] font-black border transition-colors',
                speed !== 1 ? 'text-[#FF5500] border-[#FF5500]/30 bg-[#FF5500]/10' : 'text-text-muted border-white/10 hover:text-white hover:border-white/20'
              )}
            >
              {speed}x
            </button>

            <div className="hidden lg:flex items-center gap-1.5 group">
              <button onClick={toggleMute} className="text-text-muted hover:text-white transition-colors">
                {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0" max="1" step="0.01"
                value={muted ? 0 : volume}
                onChange={(e) => { setMuted(false); setVolume(parseFloat(e.target.value)) }}
                className="w-16 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-[#FF5500]"
              />
            </div>

            <button
              onClick={() => usePlayerStore.getState().setBeat(null as any)}
              className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-text-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </>
)
}

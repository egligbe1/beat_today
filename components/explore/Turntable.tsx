'use client'

import React, { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

interface TurntableProps {
  isPlaying: boolean
  coverUrl: string
  title: string
  bpm?: number
  index?: number
}

// Optimized Turntable Component (Fidelity Pruning)
const Turntable = memo(function Turntable({ isPlaying, coverUrl, title, bpm, index = 0 }: TurntableProps) {
  const rotationDuration = bpm ? (240 / bpm) : 2

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {/* Vinyl Disc Base */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-[0%] z-10 rounded-full bg-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,1)] border border-white/5"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: rotationDuration, repeat: Infinity, ease: 'linear' }}
              className="w-full h-full relative"
            >
              <svg viewBox="0 0 400 400" className="w-full h-full">
                <circle cx="200" cy="200" r="195" fill="#080808" />
                {/* Simplified Grooves */}
                {[180, 160, 140, 120, 100, 80].map((r) => (
                  <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                ))}
                {/* Center Label */}
                <circle cx="200" cy="200" r="60" fill="#151515" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <clipPath id={`centerLabel-${index}`}>
                  <circle cx="200" cy="200" r="58" />
                </clipPath>
                <g clipPath={`url(#centerLabel-${index})`}>
                  <image href={coverUrl} x="142" y="142" width="116" height="116" preserveAspectRatio="xMidYMid slice" />
                </g>
                <circle cx="200" cy="200" r="5" fill="#000" />
              </svg>
            </motion.div>

            {/* Tonearm */}
            <div className="absolute -top-[5%] -right-[5%] w-[40%] h-[60%] z-30 pointer-events-none origin-top-right">
              <motion.svg
                viewBox="0 0 180 240"
                className="w-full h-full"
                initial={{ rotate: 0 }}
                animate={{ rotate: isPlaying ? 24 : 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 45 }}
                style={{ transformOrigin: '148px 24px' }}
              >
                <circle cx="148" cy="24" r="18" fill="#222" stroke="rgba(255,255,255,0.1)" />
                <line x1="148" y1="24" x2="40" y2="180" stroke="#888" strokeWidth="4" />
                <rect x="25" y="180" width="30" height="20" rx="4" fill="#222" stroke="rgba(255,255,255,0.1)" />
              </motion.svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PAUSED: Simple Square Cover */}
      {!isPlaying && (
        <motion.div
          key="cover"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-2 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
        >
          <Image src={coverUrl} alt={title} fill className="object-cover" />
        </motion.div>
      )}
    </div>
  )
})

export default Turntable

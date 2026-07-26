'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Play, Sparkles } from 'lucide-react'

interface Slide {
  id: string
  title: string
  subtitle: string
  image: string
  ctaText: string
  ctaHref: string
  accentColor: string
}

const DEFAULT_SLIDES: Slide[] = [
  {
    id: 's1',
    title: "Your First Hit Starts Here.",
    subtitle: "License premium beats from Africa's top producers. Instant delivery. Full ownership.",
    image: "/hero-studio.webp",
    ctaText: "Explore Discovery",
    ctaHref: "/search",
    accentColor: "#FF5500"
  },
  {
    id: 's2',
    title: "The Sound of the Future.",
    subtitle: "Amapiano, Afrobeats, and Drill. The world is listening to the rhythm of the continent.",
    image: "/genre-rnb.webp", // Fallback image
    ctaText: "Browse Genres",
    ctaHref: "/search?genre=Amapiano",
    accentColor: "#FFB000"
  }
]

export default function HeroCarousel({ tracks = [] }: { tracks?: any[] }) {
  const [current, setCurrent] = useState(0)
  // Skip the fade-in on the very first paint so the hero is visible immediately
  // in the server-rendered HTML (no dark gap while JS loads). Only slide
  // transitions after mount animate.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Create slides: Main brand slide always first, then featured tracks
  const dynamicSlides = tracks.slice(0, 3).map((track, i) => ({
    id: track.id,
    title: track.title,
    subtitle: `Produced by ${track.users_profiles?.display_name || 'Top Producer'}`,
    image: track.cover_url || DEFAULT_SLIDES[0].image,
    ctaText: "License Now",
    ctaHref: `/beats/${track.id}`,
    accentColor: i % 2 === 0 ? "#FF5500" : "#FFB000"
  }))

  const slides = [DEFAULT_SLIDES[0], ...dynamicSlides]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [slides.length])

  return (
    <section className="relative h-[500px] sm:h-[600px] md:h-[700px] w-full overflow-hidden bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={slides[current].id}
          initial={mounted ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {/* Background Image */}
          <Image
            src={slides[current].image}
            alt={slides[current].title}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-60"
          />
          
          {/* Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center">
            <div className="max-w-2xl">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                <div 
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest mb-6"
                  style={{ color: slides[current].accentColor }}
                >
                  <Sparkles className="w-3 h-3" />
                  Trending Now
                </div>
                
                <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter text-white mb-6 leading-[0.9]">
                  {slides[current].title.split(' ').map((word: string, i: number) => (
                    word.toLowerCase().includes('hit') || word.toLowerCase().includes('future')
                      ? <span key={i} className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5500] to-[#FFB000]">{word} </span>
                      : word + ' '
                  ))}
                </h1>
                
                <p className="text-text-muted text-lg sm:text-xl max-w-lg mb-10 font-medium leading-relaxed">
                  {slides[current].subtitle}
                </p>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                  <Link 
                    href={slides[current].ctaHref}
                    className="flex items-center justify-center h-14 px-10 bg-[#FF5500] text-white rounded-full font-black text-base uppercase tracking-wide hover:bg-[#FF5500]/90 active:scale-95 transition-all shadow-2xl shadow-[#FF5500]/20"
                  >
                    {slides[current].ctaText}
                  </Link>
                  <Link 
                    href="/signup?role=producer"
                    className="flex items-center justify-center h-14 px-8 bg-white/5 border border-white/10 text-white rounded-full font-black text-base uppercase tracking-wide hover:bg-white/15 transition-all"
                  >
                    Join the Collective
                  </Link>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress Indicators */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 transition-all duration-300 rounded-full ${
              current === i ? "w-8 bg-[#FF5500]" : "w-1.5 bg-white/20 hover:bg-white/40"
            }`}
          />
        ))}
      </div>
    </section>
  )
}

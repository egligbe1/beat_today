import Link from 'next/link'
import { Music, Home, Search } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-8">
        <Music className="w-10 h-10 text-white/20" />
      </div>
      <p className="text-6xl font-black text-white tracking-tighter mb-3">404</p>
      <h1 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
        Track not found
      </h1>
      <p className="text-text-muted max-w-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        Let&apos;s get you back to the beats.
      </p>
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          href="/"
          className="h-14 px-8 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 hover:scale-105 transition-all shadow-xl"
        >
          <Home className="w-5 h-5" /> Go Home
        </Link>
        <Link
          href="/search"
          className="h-14 px-8 bg-white/5 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-3 hover:bg-white/10 transition-all"
        >
          <Search className="w-5 h-5" /> Browse Beats
        </Link>
      </div>
    </div>
  )
}

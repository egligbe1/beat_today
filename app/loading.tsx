import { Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center">
      <div className="relative">
        {/* Pulsing Site Logo */}
        <div className="w-20 h-20 relative animate-pulse">
          <Image
            src="/icon.webp"
            alt="Loading..."
            fill
            className="object-contain brightness-125"
            priority
          />
        </div>

        {/* Glow effect */}
        <div className="absolute inset-0 bg-[#FF2D55]/20 blur-2xl rounded-full -z-10" />
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-[#FF2D55] animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            Loading...
          </span>
        </div>

        {/* Progress simulator line */}
        <div className="w-32 h-[1px] bg-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FF2D55] to-transparent w-full animate-progress-slide" />
        </div>
      </div>
    </div>
  )
}

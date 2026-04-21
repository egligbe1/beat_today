import { Music, Play } from 'lucide-react'

export default function ExploreLoading() {
  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden">
      {/* Immersive Background Placeholder */}
      <div className="absolute inset-0 bg-zinc-950" />
      
      {/* Central Vinyl Skeleton */}
      <div className="relative flex-1 flex items-center justify-center p-24">
        <div className="w-full max-w-sm aspect-square relative">
          {/* Pulsing Platter */}
          <div className="absolute inset-[-10%] rounded-full bg-zinc-900/50 animate-pulse border border-white/5" />
          
          {/* Main Disc Skeleton */}
          <div className="absolute inset-0 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center overflow-hidden">
            <div className="w-24 h-24 rounded-full bg-black/40 flex items-center justify-center animate-pulse">
              <Music className="w-10 h-10 text-white/5" />
            </div>
          </div>
          
          {/* Progress Ring Skeleton */}
          <div className="absolute inset-[-4%] rounded-full border-2 border-white/5 opacity-20" />
        </div>
      </div>

      {/* Side Actions Skeleton */}
      <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
        ))}
      </div>

      {/* Bottom Info Skeleton */}
      <div className="absolute bottom-10 left-6 right-20 space-y-3">
        <div className="h-6 w-48 bg-white/10 rounded animate-pulse" />
        <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
      </div>

      {/* Bottom Seek Bar Placeholder */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5" />
      
      {/* Top Bar Placeholder */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-50">
        <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
        <div className="w-32 h-6 bg-white/5 rounded-full animate-pulse" />
        <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
      </div>
    </div>
  )
}

export default function BeatLoading() {
  return (
    <div className="min-h-screen bg-bg-primary pt-32 pb-24 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
        {/* Cover skeleton */}
        <div className="aspect-square bg-white/5 rounded-3xl animate-pulse max-w-lg mx-auto w-full" />
        {/* Info skeleton */}
        <div className="space-y-6 pt-4">
          <div className="h-5 bg-white/5 rounded animate-pulse w-20" />
          <div className="h-10 bg-white/5 rounded animate-pulse w-3/4" />
          <div className="h-5 bg-white/5 rounded animate-pulse w-40" />
          <div className="h-4 bg-white/5 rounded animate-pulse w-1/2" />
          <div className="flex gap-3 mt-8">
            <div className="h-14 bg-white/5 rounded-2xl animate-pulse flex-1" />
            <div className="h-14 w-14 bg-white/5 rounded-2xl animate-pulse" />
            <div className="h-14 w-14 bg-white/5 rounded-2xl animate-pulse" />
          </div>
          <div className="space-y-3 mt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

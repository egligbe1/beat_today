export default function Loading() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero skeleton */}
      <div className="h-[500px] md:h-[600px] bg-white/5 animate-pulse" />
      {/* Beat grid skeleton */}
      <div className="max-w-7xl mx-auto px-6 py-32">
        <div className="h-8 bg-white/5 rounded animate-pulse w-48 mb-12" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square bg-white/5 rounded-2xl animate-pulse" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

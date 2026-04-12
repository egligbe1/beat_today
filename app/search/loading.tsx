export default function SearchLoading() {
  return (
    <div className="min-h-screen bg-bg-primary pt-32 pb-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Filter bar skeleton */}
        <div className="h-14 bg-white/5 rounded-2xl animate-pulse mb-8 w-full" />
        {/* Beat grid skeleton */}
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

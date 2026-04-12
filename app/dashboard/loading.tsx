export default function DashboardLoading() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-bg-primary flex items-center justify-center px-4">
      <div className="max-w-4xl w-full animate-fade-in space-y-6">
        <div className="h-10 bg-white/5 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="h-40 bg-white/5 rounded-3xl animate-pulse" />
          <div className="h-40 bg-white/5 rounded-3xl animate-pulse" />
          <div className="h-40 bg-white/5 rounded-3xl animate-pulse" />
          <div className="h-40 bg-white/5 rounded-3xl animate-pulse" />
        </div>
        <div className="h-64 bg-white/5 rounded-[40px] animate-pulse" />
      </div>
    </div>
  )
}

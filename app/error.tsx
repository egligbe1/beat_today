'use client'
 
import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import Link from 'next/link'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('BeatToday Global Error:', error)
  }, [error])
 
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center px-4 py-20 relative overflow-hidden text-center">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-lg w-full space-y-8 animate-fade-in">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        
        <h1 className="text-4xl font-black uppercase tracking-tight">Something went wrong</h1>
        <p className="text-text-muted text-lg">
          We encountered an unexpected error while processing your request. Don&apos;t worry, your data is safe.
        </p>

        <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
                onClick={() => reset()}
                className="h-14 px-8 bg-white text-black rounded-xl font-bold text-lg inline-flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-all gap-3 shadow-xl"
            >
                <RefreshCcw className="w-5 h-5" />
                Try again
            </button>
            <Link href="/" className="h-14 px-8 bg-bg-surface border border-border-subtle text-text-primary rounded-xl font-bold text-lg inline-flex items-center justify-center hover:bg-bg-elevated transition-colors">
                Go Home
            </Link>
        </div>
      </div>
    </div>
  )
}

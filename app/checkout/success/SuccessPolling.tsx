'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SuccessPolling({ orderId }: { orderId: string }) {
  const router = useRouter()

  useEffect(() => {
    // Poll every 3 seconds to check if the status has changed
    const interval = setInterval(() => {
      router.refresh()
    }, 3000)

    return () => clearInterval(interval)
  }, [router])

  return (
    <div className="flex flex-col items-center gap-4 py-8 animate-pulse">
      <div className="h-1 bg-white/10 w-48 rounded-full overflow-hidden">
        <div className="h-full bg-accent-orange w-1/2 animate-[loading_1.5s_infinite_ease-in-out]" />
      </div>
      <p className="text-sm text-text-muted font-bold uppercase tracking-widest">
        Finalizing your downloads...
      </p>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}

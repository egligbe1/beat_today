import { XCircle } from 'lucide-react'
import Link from 'next/link'

export default function CheckoutFailedPage() {
  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center py-20 px-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full space-y-8 relative z-10 text-center">
        
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <XCircle className="w-12 h-12 text-red-500" />
        </div>

        <h1 className="text-4xl font-black uppercase tracking-tight">Payment Failed</h1>
        <p className="text-text-muted text-lg">
            We couldn&apos;t process your payment. Your cart has been saved, please try again.
        </p>

        <div className="pt-8 flex flex-col gap-4">
            <Link href="/" className="h-14 px-8 bg-accent-orange text-white rounded-xl font-bold text-lg inline-flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-accent-orange/20">
                Try Again
            </Link>
            <Link href="/contact" className="h-14 px-8 bg-bg-surface border border-border-subtle text-text-primary rounded-xl font-bold text-lg inline-flex items-center justify-center hover:bg-bg-elevated transition-colors">
                Contact Support
            </Link>
        </div>
      </div>
    </div>
  )
}

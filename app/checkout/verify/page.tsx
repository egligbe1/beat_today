'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/lib/utils/toast'

export default function CheckoutVerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const reference = searchParams.get('reference')
        const trxref = searchParams.get('trxref')

        if (!reference) {
          setError('No payment reference found')
          setLoading(false)
          return
        }

        // Verify transaction with Paystack
        const response = await fetch(`/api/webhooks/paystack/verify?reference=${reference}`, {
          method: 'GET',
        })

        const data = await response.json()

        if (data.success) {
          // Payment successful, redirect to success page
          router.push(`/checkout/success?order_id=${data.order_id}`)
        } else {
          // Payment failed or pending, redirect to failed page
          router.push('/checkout/failed')
        }
      } catch (err: any) {
        console.error('Verification error:', err)
        setError('Failed to verify payment')
        setLoading(false)
      }
    }

    verifyPayment()
  }, [searchParams, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-gold mx-auto mb-4"></div>
          <p className="text-white text-lg">Verifying your payment...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-white text-2xl font-bold mb-4">Verification Error</h1>
          <p className="text-text-muted mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-accent-gold text-black px-6 py-3 rounded-lg font-semibold hover:bg-accent-gold/90 transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return null
}
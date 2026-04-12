'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SocialLogin from '@/components/auth/SocialLogin'
import CountrySelect from '@/components/ui/CountrySelect'
import { showToast } from '@/lib/utils/toast'


export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [role, setRole] = useState<'producer' | 'artist'>('artist')
  const [country, setCountry] = useState('Nigeria')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Handle Validation State
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null)
  const [checkingHandle, setCheckingHandle] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const getAuthRedirectUrl = () => {
    const publicUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    if (publicUrl) {
      return `${publicUrl}/api/auth/callback`
    }

    if (globalThis.window) {
      return `${globalThis.window.location.origin.replace('0.0.0.0', 'localhost')}/api/auth/callback`
    }

    return 'http://localhost:3000/api/auth/callback'
  }

  useEffect(() => {
    if (!handle || handle.length < 3) {
      setHandleAvailable(null)
      return
    }

    const checkHandle = setTimeout(async () => {
      setCheckingHandle(true)
      try {
        const res = await fetch(`/api/check-handle?handle=${encodeURIComponent(handle)}`)
        if (res.ok) {
          const data = await res.json()
          setHandleAvailable(data.available)
        }
      } catch (err) {
        setHandleAvailable(null)
      } finally {
        setCheckingHandle(false)
      }
    }, 500)

    return () => clearTimeout(checkHandle)
  }, [handle])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // 1. Sign up user
    const { data: authData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
        data: {
          display_name: displayName,
          handle,
          role,
          country,
        },
      },
    })

    if (signupError) {
      if (signupError.message.includes('Error sending confirmation email')) {
        setError("Account created, but we couldn't send a confirmation email. This usually happens if SMTP is not configured in your Supabase project. Please check your email settings or contact support.")
        showToast.info("Account created, but email delivery failed.")
      } else {
        setError(signupError.message)
        showToast.error(signupError.message)
      }
      setLoading(false)
      return
    }

    if (authData.user) {
      // Don't create profile here - wait for email confirmation
      // The auth callback will redirect to complete-profile if needed
      
      if (authData.session) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
          }),
        })
      }

      router.push('/')
      showToast.success('Signup successful! Please check your email to confirm your account.')
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary px-4 py-12">
      <div className="w-full max-w-md bg-bg-surface p-8 rounded-xl border border-border-subtle">
        <h1 className="text-2xl font-bold text-text-primary mb-6 text-center">Join BeatToday</h1>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="flex gap-4 p-1 bg-bg-primary rounded-lg border border-border-subtle mb-4">
            <button
              type="button"
              onClick={() => setRole('artist')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                role === 'artist' ? 'bg-accent-orange text-white' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Artist
            </button>
            <button
              type="button"
              onClick={() => setRole('producer')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                role === 'producer' ? 'bg-accent-orange text-white' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Producer
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-bg-primary border border-border-subtle rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-orange"
              placeholder="e.g. Metro Boomin"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-text-muted">Handle (@username)</label>
               {checkingHandle && <span className="text-xs text-text-muted animate-pulse">Checking...</span>}
               {handleAvailable === true && !checkingHandle && handle.length >= 3 && <span className="text-xs font-bold text-accent-green">Available</span>}
               {handleAvailable === false && !checkingHandle && <span className="text-xs font-bold text-red-500">Taken</span>}
            </div>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
              className={`w-full bg-bg-primary border rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-orange transition-colors ${handleAvailable === false ? 'border-red-500' : 'border-border-subtle'}`}
              placeholder="e.g. metro-beats"
              required
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-text-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-primary border border-border-subtle rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-orange"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-primary border border-border-subtle rounded-md px-4 py-2 text-text-primary focus:outline-none focus:border-accent-orange"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Country</label>
            <CountrySelect
              value={country}
              onChange={setCountry}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || handleAvailable === false}
            className="w-full btn-primary mt-4 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-8">
          <SocialLogin />
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-orange hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}

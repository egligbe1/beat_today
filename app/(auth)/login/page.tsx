'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SocialLogin from '@/components/auth/SocialLogin'
import { showToast } from '@/lib/utils/toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
      setError(loginError.message)
      showToast.error(loginError.message)
      setLoading(false)
      return
    }

    if (data.session) {
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      })
    }

    // Fetch user role to redirect
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'producer') {
      router.push('/dashboard')
    } else {
      router.push('/')
    }
    showToast.success('Login successful!')
    router.refresh()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary px-4">
      <div className="w-full max-w-md bg-bg-surface p-8 rounded-xl border border-border-subtle">
        <h1 className="text-2xl font-bold text-text-primary mb-6 text-center">Login to BeatToday</h1>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary mt-4 disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-8">
          <SocialLogin />
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-accent-orange hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

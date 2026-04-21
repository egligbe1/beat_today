'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import CountrySelect from '@/components/ui/CountrySelect'

export default function CompleteProfilePage() {
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

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('id, role, handle')
        .eq('id', user.id)
        .single()
      
      // Only redirect if they have a role AND a proper handle (onboarding complete)
      if (profile?.role && profile?.handle && !profile.handle.includes('v_handle')) {
        router.push('/')
      }

      // Pre-fill form with signup data from user metadata
      if (user.user_metadata?.display_name || user.user_metadata?.full_name) {
        setDisplayName(user.user_metadata.display_name || user.user_metadata.full_name)
      }
      if (user.user_metadata?.handle) {
        setHandle(user.user_metadata.handle)
      }
      if (user.user_metadata?.role) {
        setRole(user.user_metadata.role)
      }
      if (user.user_metadata?.country) {
        setCountry(user.user_metadata.country)
      }
    }
    checkUser()
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { error: profileError } = await supabase
        .from('users_profiles')
        .upsert({
          id: user.id,
          display_name: displayName,
          handle,
          role,
          country,
        })

      if (profileError) throw profileError

      if (role === 'producer') {
        const { error: settingsError } = await supabase
          .from('producer_settings')
          .upsert({
            user_id: user.id,
          })

        if (settingsError) throw settingsError
      }

      router.push(role === 'producer' ? '/dashboard' : '/')
      // Force a hard refresh to ensure Navbar role state is re-fetched from DB
      window.location.href = role === 'producer' ? '/dashboard' : '/'
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary px-4 py-12">
      <div className="w-full max-w-md bg-bg-surface p-8 rounded-xl border border-border-subtle">
        <h1 className="text-2xl font-bold text-text-primary mb-2 text-center">Complete Your Profile</h1>
        <p className="text-text-muted text-sm mb-6 text-center">Just a few more details to get started.</p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-md mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {loading ? 'Saving...' : 'Finish Setup'}
          </button>
        </form>
      </div>
    </div>
  )
}

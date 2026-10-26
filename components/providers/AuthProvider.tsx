'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  profile: any | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true
})

export function AuthProvider({ 
  children, 
  initialUser, 
  initialProfile 
}: { 
  children: React.ReactNode
  initialUser: User | null
  initialProfile: any | null
}) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [profile, setProfile] = useState<any | null>(initialProfile)
  const [loading, setLoading] = useState(!initialUser)
  const supabase = createClient()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (!session?.user) setProfile(null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    if (!user || profile?.id === user.id) return
    setProfile(null)
    supabase.from('users_profiles').select('*').eq('id', user.id).single().then(({ data, error }) => {
      if (!cancelled) {
        if (error) console.error('Profile lookup failed', error)
        setProfile(data)
      }
    })
    return () => { cancelled = true }
  }, [user, profile, supabase])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

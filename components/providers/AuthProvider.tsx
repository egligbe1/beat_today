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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        // If we don't have a profile yet (or it's a different user), fetch it
        if (!profile || profile.id !== session.user.id) {
          const { data } = await supabase
            .from('users_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          setProfile(data)
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase, profile])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

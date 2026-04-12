import { cache } from 'react'
import { createClient } from './supabase/server'

export type AuthContext = {
  user: any | null
  profile: any | null
  error: any | null
}

/**
 * Fetches the current user and their profile, caching the result
 * for the duration of the current request.
 */
export const getCachedAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = createClient()
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { user: null, profile: null, error: authError }
    }

    const { data: profile, error: dbError } = await supabase
      .from('users_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return { user, profile, error: dbError }
  } catch (err) {
    return { user: null, profile: null, error: err }
  }
})

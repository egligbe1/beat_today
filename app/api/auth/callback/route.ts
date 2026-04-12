import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const searchParams = requestUrl.searchParams
  const code = searchParams.get('code')
  // if "next" is in search params, use it as the redirection URL
  const next = searchParams.get('next') ?? '/'
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && session) {
      // Check if user has a profile
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('id')
        .eq('id', session.user.id)
        .single()

      if (!profile) {
        // Try to create profile automatically from user metadata (email signup)
        const userMetadata = session.user.user_metadata
        if (userMetadata?.display_name && userMetadata?.handle && userMetadata?.role && userMetadata?.country) {
          const { error: createError } = await supabase
            .from('users_profiles')
            .insert({
              id: session.user.id,
              display_name: userMetadata.display_name,
              handle: userMetadata.handle,
              role: userMetadata.role,
              country: userMetadata.country,
            })

          if (!createError) {
            // Profile created successfully, redirect to next
            return NextResponse.redirect(`${origin}${next}`)
          }
          // If creation failed, redirect to complete-profile
        }
        
        // No metadata or creation failed - redirect to complete profile
        return NextResponse.redirect(`${origin}/complete-profile`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}

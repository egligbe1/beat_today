import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Only fetch profile for dashboard routes to save DB calls on public pages
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      
    const allowedRoles = ['producer', 'artist']
    if (!profile?.role || (!allowedRoles.includes(profile.role) && request.nextUrl.pathname !== '/dashboard/unauthorized')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Redirect authenticated users away from login/signup
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // --- Geo-IP Currency Localization ---
  const countryCode = request.headers.get('x-vercel-ip-country') || request.geo?.country || 'US'
  const urlCurrency = request.nextUrl.searchParams.get('currency')?.toUpperCase()
  
  let detectedCurrency = 'USD'
  switch (countryCode) {
    case 'NG': detectedCurrency = 'NGN'; break
    case 'GH': detectedCurrency = 'GHS'; break
    case 'ZA': detectedCurrency = 'ZAR'; break
    case 'KE': detectedCurrency = 'KES'; break
    case 'GB': detectedCurrency = 'GBP'; break
    case 'DE': case 'FR': case 'IT': case 'ES': case 'NL': case 'BE': case 'IE':
      detectedCurrency = 'EUR'
      break
    default: detectedCurrency = 'USD'; break
  }

  // Override if explicitly requested in URL
  const targetCurrency = urlCurrency || request.cookies.get('user-currency')?.value || detectedCurrency
  
  // Set the cookie if it's missing or if a new override was requested
  if ((!request.cookies.has('user-currency') || urlCurrency) && !request.nextUrl.pathname.startsWith('/_next')) {
    response.cookies.set({
        name: 'user-currency',
        value: targetCurrency,
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: 'lax',
    })
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/ (handled by route-level auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png, og-image.jpg (public assets)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|icon.png|og-image.jpg).*)',
  ],
}

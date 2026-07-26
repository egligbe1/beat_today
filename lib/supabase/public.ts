import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cookie-free Supabase client for PUBLIC, non-personalized server reads.
 *
 * Unlike the cookie-bound server client (`lib/supabase/server.ts`), this one
 * never touches `cookies()`, so pages that use it — and only read public data —
 * can be statically generated / ISR-cached (`export const revalidate = N`)
 * instead of being forced into per-request dynamic rendering.
 *
 * Only use this for data that is the same for every visitor (charts, public
 * catalog listings). For anything user-specific, use the cookie-bound client.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

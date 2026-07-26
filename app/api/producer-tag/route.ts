import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listObjects, publicUrl, R2_PUBLIC_BUCKET } from '@/lib/r2'

// GET /api/producer-tag — returns the authed producer's custom tag URL if one
// exists in R2 (the browser can't list a private-credential bucket itself).
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ url: null }, { status: 401 })

  try {
    const key = `producer-tags/${user.id}/tag.mp3`
    const keys = await listObjects(R2_PUBLIC_BUCKET, key)
    const exists = keys.includes(key)
    return NextResponse.json({ url: exists ? publicUrl(key) : null })
  } catch {
    return NextResponse.json({ url: null })
  }
}

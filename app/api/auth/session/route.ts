import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json()

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'Missing access or refresh token.' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ session: data.session })
}

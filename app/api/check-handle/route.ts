import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const handle = searchParams.get('handle')
  
  if (!handle || handle.trim().length === 0) {
    return NextResponse.json({ available: false, error: 'Handle required' }, { status: 400 })
  }

  const formattedHandle = handle.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-')

  const { count, error } = await supabase
    .from('users_profiles')
    .select('id', { count: 'exact' })
    .eq('handle', formattedHandle)

  if (error) {
    console.error('Check handle error:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    return NextResponse.json({ available: false, error: 'Status check failed' }, { status: 500 })
  }

  return NextResponse.json({ available: count === 0 })
}

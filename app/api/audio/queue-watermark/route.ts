import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/audio/queue-watermark
 * Body: { beat_id, storage_path }
 *
 * 1. Inserts a job into watermark_jobs (so cron catches it if step 2 fails)
 * 2. Fires off /api/audio/watermark in the background (no await — returns immediately)
 *    so the upload page never blocks on FFmpeg processing
 */
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { beat_id, storage_path } = await req.json()
  if (!beat_id || !storage_path) {
    return NextResponse.json({ error: 'beat_id and storage_path required' }, { status: 400 })
  }

  // Verify the beat belongs to this producer
  const { data: beat } = await supabaseAdmin
    .from('beats')
    .select('id, producer_id')
    .eq('id', beat_id)
    .single()

  if (!beat || beat.producer_id !== user.id) {
    return NextResponse.json({ error: 'Beat not found or not yours' }, { status: 403 })
  }

  // 1. Insert into the job queue for cron retry resilience.
  await supabaseAdmin
    .from('watermark_jobs')
    .upsert(
      { beat_id, storage_path, status: 'pending', attempts: 0, error: null, processed_at: null },
      { onConflict: 'beat_id' }
    )

  // 2. Trigger the watermark API in the background (no await)
  // This allows the upload to finish instantly while the server starts processing.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  fetch(`${siteUrl}/api/audio/watermark`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`
    },
    body: JSON.stringify({ beat_id, storage_path }),
  }).catch(err => console.error('[QUEUE] Failed to trigger background watermark:', err))

  return NextResponse.json({ success: true })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function DELETE(
  req: Request,
  { params }: { params: { beatId: string } }
) {
  try {
    const beatId = params.beatId
    const supabase = createClient()
    
    // 1. Verify Authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 2. Fetch beat to get file paths before deletion
    const { data: beat, error: fetchError } = await supabaseAdmin
      .from('beats')
      .select('producer_id, file_mp3_url, file_wav_url, file_stems_url, mp3_preview_url, cover_url')
      .eq('id', beatId)
      .single()

    if (fetchError || !beat) {
      return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
    }

    // 3. Verify Ownership
    if (beat.producer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Extract storage paths
    const normalizePath = (val: string | null) => {
      if (!val) return null
      if (val.startsWith('http')) {
        try {
          const url = new URL(val)
          const match = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+)/)
          return match ? decodeURIComponent(match[1]) : null
        } catch { return null }
      }
      return val
    }

    const filesToDelete = {
      'beat-files': [
        normalizePath(beat.file_mp3_url),
        normalizePath(beat.file_wav_url),
        normalizePath(beat.file_stems_url)
      ].filter(Boolean) as string[],
      'beat-previews': [
        normalizePath(beat.mp3_preview_url)
      ].filter(Boolean) as string[],
      'beat-covers': [
        normalizePath(beat.cover_url)
      ].filter(Boolean) as string[]
    }

    // 5. Delete from Storage
    await Promise.all(
      Object.entries(filesToDelete).map(async ([bucket, paths]) => {
        if (paths.length > 0) {
          await supabaseAdmin.storage.from(bucket).remove(paths)
        }
      })
    )

    // 6. Delete from Database
    const { error: deleteError } = await supabaseAdmin
      .from('beats')
      .delete()
      .eq('id', beatId)

    if (deleteError) {
      console.error('Database deletion error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Delete API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

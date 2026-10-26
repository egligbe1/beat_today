import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_RE } from '@/lib/security'
/** Removing a listing archives it. Audio, order records and licenses are retained. */
export async function DELETE(request: Request, { params }: { params: Promise<{ beatId: string }> }) {
  const { beatId } = await params
  if (!UUID_RE.test(beatId)) return NextResponse.json({ error: 'Invalid beat' }, { status: 400 })
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await createAdminClient().from('beats').update({ status: 'hidden' })
    .eq('id', beatId).eq('producer_id', user.id).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'Unable to archive beat' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Beat not found' }, { status: 404 })
  return NextResponse.json({ success: true, archived: true })
}

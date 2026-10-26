import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/security'
import type { StudioAgreement } from '@/lib/types'
import AgreementPDF from '@/components/studio/AgreementPDF'
import { rateLimit } from '@/lib/rateLimit'
export const runtime = 'nodejs'
export async function GET(_request: Request, { params }: { params: Promise<{ agreementId: string }> }) {
  const { agreementId } = await params
  if (!UUID_RE.test(agreementId)) return NextResponse.json({ error: 'Agreement unavailable' }, { status: 404 })
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 })
  if (!await rateLimit(`studio-pdf:${user.id}`, 10, 60)) return NextResponse.json({ error: 'Please wait before downloading again' }, { status: 429 })
  const { data, error } = await db.from('studio_agreements').select('*').eq('id', agreementId).maybeSingle()
  if (error) return NextResponse.json({ error: 'Agreement could not be loaded' }, { status: 503 })
  if (!data) return NextResponse.json({ error: 'Agreement unavailable' }, { status: 404 })
  const buffer = await renderToBuffer(<AgreementPDF agreement={data as StudioAgreement} />)
  return new NextResponse(new Uint8Array(buffer), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="studio-agreement-v${data.version}.pdf"`, 'Cache-Control': 'private, no-store',
  } })
}

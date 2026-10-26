import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateAgreementPdf } from '@/lib/utils/pdfGenerator'
export async function GET(request: Request) {
  try {
    const itemId = new URL(request.url).searchParams.get('itemId')
    if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: license, error } = await supabase.from('order_item_licenses')
      .select('final_legal_text, order_items!inner(orders!inner(status,buyer_id))')
      .eq('order_item_id', itemId).eq('buyer_id', user.id).single()
    if (error || !license || (license.order_items as any)?.orders?.status !== 'completed') return NextResponse.json({ error: 'License not found' }, { status: 404 })
    const pdf = await generateAgreementPdf(license.final_legal_text)
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="BeatToday_License.pdf"', 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('License download failed', error)
    return NextResponse.json({ error: 'Unable to generate license' }, { status: 500 })
  }
}

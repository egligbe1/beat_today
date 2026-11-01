import {createAdminClient} from '@/lib/supabase/admin'
import {purchaseAccess} from '@/lib/commerce/purchaseAccess'
import {UUID_RE} from '@/lib/security'
import { NextResponse } from 'next/server'
import { generateAgreementPdf } from '@/lib/utils/pdfGenerator'
export async function GET(request: Request) {
  try {
    const itemId = new URL(request.url).searchParams.get('itemId')
    if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })
    if(!UUID_RE.test(itemId))return NextResponse.json({error:'License not found'},{status:404})
    const db=createAdminClient(),{data:item}=await db.from('order_items').select('order_id').eq('id',itemId).maybeSingle()
    const access=item?await purchaseAccess(item.order_id):null
    if(!access||access.order.status!=='completed')return NextResponse.json({error:'License not found'},{status:404})
    const {data:license,error}=await db.from('order_item_licenses').select('final_legal_text').eq('order_item_id',itemId).maybeSingle()
    if(error||!license)return NextResponse.json({error:'License not found'},{status:404})
    const pdf = await generateAgreementPdf(license.final_legal_text)
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="BeatToday_License.pdf"', 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('License download failed', error)
    return NextResponse.json({ error: 'Unable to generate license' }, { status: 500 })
  }
}

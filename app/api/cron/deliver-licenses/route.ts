import { NextResponse } from 'next/server'
import { verifyQStashSignature } from '@/lib/qstash'
import { deliverLicenses } from '@/lib/utils/fulfillOrder'
export async function POST(request: Request) {
  if (!await verifyQStashSignature(request.clone())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { await deliverLicenses(); return NextResponse.json({ success: true }) }
  catch (error) { console.error('License delivery queue failed',error); return NextResponse.json({ error: 'Retry required' },{status:500}) }
}

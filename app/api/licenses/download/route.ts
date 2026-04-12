import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateLicensePdf } from '@/lib/utils/pdfGenerator'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'Missing itemId parameter' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the order item and verifying ownership
    const { data: license, error } = await supabase
      .from('order_item_licenses')
      .select(`
        license_type,
        orders!inner(id, buyer_id),
        beats(title),
        users_profiles!order_item_licenses_producer_id_fkey(display_name, handle)
      `)
      .eq('order_item_id', itemId)
      .eq('buyer_id', user.id)
      .single()

    if (error || !license) {
      console.error('License fetch error:', error)
      return NextResponse.json({ error: 'License not found or access denied' }, { status: 404 })
    }

    // Fetch template details to generate correct PDF
    const { data: template } = await supabase
      .from('license_templates')
      .select('*')
      .eq('producer_id', license.producer_id) // We need producer_id here
      .eq('name', license.license_type)
      .single()

    // Wait, the select didn't explicitly select producer_id. Let me fetch it correctly via another query or adjust above.
    
    // Instead of doing multiple queries, I can just grab the exact same data from order_item_licenses and users_profiles
    const { data: fullLicense } = await supabase
      .from('order_item_licenses')
      .select('*')
      .eq('order_item_id', itemId)
      .single()

    const { data: producerProfile } = await supabase
      .from('users_profiles')
      .select('display_name, handle')
      .eq('id', fullLicense?.producer_id)
      .single()
      
    const { data: buyerProfile } = await supabase
      .from('users_profiles')
      .select('display_name, handle')
      .eq('id', user.id)
      .single()

    const { data: templateInfo } = await supabase
      .from('license_templates')
      .select('*')
      .eq('producer_id', fullLicense?.producer_id)
      .eq('name', fullLicense?.license_type)
      .single()

    // Since generateLicensePdf expects specific properties:
    const buyerName = buyerProfile?.display_name || buyerProfile?.handle || 'Valued Customer'
    const producerName = producerProfile?.display_name || producerProfile?.handle || 'Producer'
    const trackTitle = (license.beats as any)?.title || 'Purchased Beat'

    const pdfBuffer = await generateLicensePdf({
      orderId: (license.orders as any).id,
      buyerName,
      producerName,
      trackTitle,
      licenseType: fullLicense?.license_type || 'Unknown',
      terms: {
        streamingLimit: templateInfo?.streaming_limit?.toLocaleString() || '50,000',
        mvLimit: templateInfo?.music_video_limit?.toString() || '1',
        radioRights: templateInfo?.radio_broadcasting ? 'Radio Rights Included' : 'No Radio Rights',
        nonProfit: templateInfo?.is_non_profit_only || false,
      },
      date: new Date(fullLicense?.signed_at || new Date()).toLocaleDateString(),
    })

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="License_${trackTitle.replace(/\s+/g, '_')}.pdf"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    })

  } catch (error) {
    console.error('License PDF Endpoint Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

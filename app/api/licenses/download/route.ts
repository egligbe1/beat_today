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

    // 1. Fetch the order item license with all required joined data in ONE query
    const { data: license, error } = await supabase
      .from('order_item_licenses')
      .select(`
        producer_id,
        license_type,
        signed_at,
        order_item_id,
        orders!inner(id, buyer_id),
        beats(title),
        producer:users_profiles!order_item_licenses_producer_id_fkey(display_name, handle)
      `)
      .eq('order_item_id', itemId)
      .eq('buyer_id', user.id)
      .single()

    if (error || !license) {
      console.error('License fetch error:', error)
      return NextResponse.json({ error: 'License not found or access denied' }, { status: 404 })
    }

    // 2. Fetch template details and buyer profile in parallel for performance
    const [templateResult, buyerResult] = await Promise.all([
      supabase
        .from('license_templates')
        .select('*')
        .eq('producer_id', license.producer_id)
        .eq('name', license.license_type)
        .single(),
      supabase
        .from('users_profiles')
        .select('display_name, handle')
        .eq('id', user.id)
        .single()
    ])

    const templateInfo = templateResult.data
    const buyerProfile = buyerResult.data

    // 3. Prepare data for PDF generation
    const buyerName = buyerProfile?.display_name || buyerProfile?.handle || 'Valued Customer'
    const producerProfile = (license.producer as any)
    const producerName = producerProfile?.display_name || producerProfile?.handle || 'Producer'
    const trackTitle = (license.beats as any)?.title || 'Purchased Beat'

    const pdfBuffer = await generateLicensePdf({
      orderId: (license.orders as any).id,
      buyerName,
      producerName,
      trackTitle,
      licenseType: license.license_type || 'Unknown',
      terms: {
        streamingLimit: templateInfo?.streaming_limit?.toLocaleString() || '50,000',
        mvLimit: templateInfo?.music_video_limit?.toString() || '1',
        radioRights: templateInfo?.radio_broadcasting ? 'Radio Rights Included' : 'No Radio Rights',
        nonProfit: templateInfo?.is_non_profit_only || false,
      },
      date: new Date(license.signed_at || new Date()).toLocaleDateString(),
    })

    // 4. Return the generated PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
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

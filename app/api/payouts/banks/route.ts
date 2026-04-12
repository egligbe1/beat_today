import { NextResponse } from 'next/server'

const COUNTRY_CODE_MAP: Record<string, string> = {
  Nigeria: 'nigeria',
  Ghana: 'ghana',
  Kenya: 'kenya',
  'South Africa': 'south-africa',
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const country = searchParams.get('country') || 'Nigeria'
    const countryCode = COUNTRY_CODE_MAP[country]

    if (!countryCode) {
      return NextResponse.json({ success: false, error: 'Unsupported country for bank lookup via Paystack.' }, { status: 400 })
    }

    const secret = process.env.PAYSTACK_SECRET_KEY
    if (!secret) {
      return NextResponse.json({ success: false, error: 'Paystack secret key is not configured.' }, { status: 500 })
    }

    const response = await fetch(`https://api.paystack.co/bank?country=${countryCode}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    if (!data.status) {
      return NextResponse.json({ success: false, error: data.message || 'Failed to fetch banks from Paystack.' }, { status: 502 })
    }

    const banks = Array.isArray(data.data)
      ? data.data.map((bank: any) => ({
          ...bank,
          code: bank.code,
          name: bank.name,
        }))
      : []

    // Sort banks alphabetically
    banks.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))

    return NextResponse.json({ success: true, banks })
  } catch (err: any) {
    console.error('Bank lookup failed:', err)
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 })
  }
}

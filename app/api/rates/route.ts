import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      // Aggressively cache the response for 6 hours (21600 seconds)
      next: { revalidate: 21600 }
    })
    
    if (!res.ok) {
        throw new Error('Failed to fetch from fast rate API')
    }

    const data = await res.json()
    
    // We strictly filter down to only the currencies our platform supports 
    // to keep the client-side payload extremely lightweight.
    const platformRates = {
        USD: data.rates.USD || 1,
        NGN: data.rates.NGN,
        GHS: data.rates.GHS,
        ZAR: data.rates.ZAR,
        KES: data.rates.KES,
        GBP: data.rates.GBP,
        EUR: data.rates.EUR
    }
    
    return NextResponse.json(platformRates)
  } catch(error: any) {
    console.error("Live Rates Error:", error)
    // Fallback to absolute last resort mock rates to ensure the site's economy never breaks
    const fallback = {
        USD: 1, NGN: 1550, GHS: 14.5, ZAR: 18.5, KES: 130, GBP: 0.78, EUR: 0.92
    }
    return NextResponse.json(fallback)
  }
}

/**
 * Server-side Currency & Exchange Rate Utility
 * Powered by open.er-api.com (6-hour cache)
 */

export async function getExchangeRates({allowFallback=true}:{allowFallback?:boolean}={}) {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 21600 }, // 6 hours
      signal: AbortSignal.timeout(8000)
    })
    
    if (!res.ok) throw new Error('API unstable')
    
    const data = await res.json()
    if(!data.rates || !Number.isFinite(data.rates.GHS) || data.rates.GHS<=0 || data.rates.USD!==1)throw new Error('Invalid exchange rates')
    return data.rates
  } catch (error) {
    if(!allowFallback)throw new Error('Exchange rates are temporarily unavailable; no payment has been started')
    console.error('Exchange rate display fallback in use')
    // Fallback constants to prevent platform crash
    return {
      USD: 1,
      NGN: 1550,
      GHS: 14.5,
      ZAR: 18.5,
      KES: 131,
      GBP: 0.79,
      EUR: 0.92
    }
  }
}

export async function convertToCurrency(amountUsd: number, targetCurrency: string) {
  const rates = await getExchangeRates()
  const rate = rates[targetCurrency] || 1
  return {
    amount: amountUsd * rate,
    rate: rate
  }
}

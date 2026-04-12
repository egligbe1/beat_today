/**
 * Server-side Currency & Exchange Rate Utility
 * Powered by open.er-api.com (6-hour cache)
 */

export async function getExchangeRates() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 21600 } // 6 hours
    })
    
    if (!res.ok) throw new Error('API unstable')
    
    const data = await res.json()
    return data.rates
  } catch (error) {
    console.error("Exchange Rate Fetch Failed:", error)
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

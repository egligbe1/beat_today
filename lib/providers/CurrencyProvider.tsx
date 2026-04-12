'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type CurrencyCode = 'USD' | 'NGN' | 'GHS' | 'ZAR' | 'KES' | 'GBP' | 'EUR'

const LOCALES: Record<CurrencyCode, string> = {
  USD: 'en-US',
  NGN: 'en-NG',
  GHS: 'en-GH',
  ZAR: 'en-ZA',
  KES: 'en-KE',
  GBP: 'en-GB',
  EUR: 'de-DE',
}

// Map ISO country codes → display currency
const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  US: 'USD', CA: 'USD', AU: 'USD',
  NG: 'NGN',
  GH: 'GHS',
  ZA: 'ZAR',
  KE: 'KES',
  GB: 'GBP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  NL: 'EUR', BE: 'EUR', IE: 'EUR', PT: 'EUR',
}

const SUPPORTED: CurrencyCode[] = ['USD', 'NGN', 'GHS', 'ZAR', 'KES', 'GBP', 'EUR']

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 30 // 30 days
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};samesite=lax`
}

interface CurrencyContextType {
  currency: CurrencyCode
  setCurrency: (currency: CurrencyCode) => void
  convertAndFormat: (usdAmount: number) => string
  rates: Record<string, number> | null
  detected: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD')
  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [mounted, setMounted] = useState(false)
  const [detected, setDetected] = useState(false)

  useEffect(() => {
    setMounted(true)

    async function init() {
      // 1. Fetch live exchange rates
      let liveRates: Record<string, number> = { USD: 1, NGN: 1550, GHS: 14.5, ZAR: 18.5, KES: 130, GBP: 0.78, EUR: 0.92 }
      try {
        const res = await fetch('/api/rates')
        if (res.ok) liveRates = await res.json()
      } catch { /* use fallback */ }
      setRates(liveRates)

      // 2. Check for existing cookie (set by middleware geo-IP or previous manual selection)
      const cookieCurrency = getCookie('user-currency') as CurrencyCode | null
      if (cookieCurrency && SUPPORTED.includes(cookieCurrency)) {
        setCurrencyState(cookieCurrency)
        setDetected(true)
        return
      }

      // 3. No cookie — try client-side IP geolocation as fallback (works in dev / non-Vercel)
      try {
        const geoRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
        if (geoRes.ok) {
          const geo = await geoRes.json()
          const detected = COUNTRY_CURRENCY[geo.country_code as string] || 'USD'
          setCurrencyState(detected)
          setCookie('user-currency', detected)
          setDetected(true)
          return
        }
      } catch { /* silently fall back to USD */ }

      // 4. Ultimate fallback — USD
      setCurrencyState('USD')
      setDetected(true)
    }

    init()
  }, [])

  const setCurrency = (newCurrency: CurrencyCode) => {
    setCurrencyState(newCurrency)
    setCookie('user-currency', newCurrency) // persist so it survives refresh
  }

  const convertAndFormat = (usdAmount: number): string => {
    const activeCurrency = mounted && rates ? currency : 'USD'
    const rate = rates ? (rates[activeCurrency] ?? 1) : 1
    const converted = usdAmount * rate

    return new Intl.NumberFormat(LOCALES[activeCurrency], {
      style: 'currency',
      currency: activeCurrency,
      maximumFractionDigits: activeCurrency === 'NGN' ? 0 : 2,
    }).format(converted)
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convertAndFormat, rates, detected }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider')
  return context
}

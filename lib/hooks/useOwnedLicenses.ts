'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Shared, process-wide cache so a grid of N cards resolves the buyer's owned
// licenses with a SINGLE round-trip (one auth call + one query) instead of N.
// The value is a map of beat_id -> owned license types for the current user.
type OwnedMap = Map<string, string[]>
let ownedCache: Promise<OwnedMap> | null = null

async function loadOwnedMap(): Promise<OwnedMap> {
  const supabase = createClient()
  const map: OwnedMap = new Map()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return map

  // All owned/in-flight licenses for this user, across every beat.
  const { data, error } = await supabase
    .from('order_items')
    .select(`
      beat_id,
      license_type,
      orders!inner(status, buyer_id)
    `)
    .eq('orders.buyer_id', user.id)
    .in('orders.status', ['completed', 'pending'])

  if (error) {
    console.error('Error fetching owned licenses:', error)
    return map
  }

  for (const item of data || []) {
    const list = map.get(item.beat_id) || []
    list.push(item.license_type)
    map.set(item.beat_id, list)
  }
  return map
}

// Call after a purchase/checkout so the next reads reflect new ownership.
export function invalidateOwnedLicenses() {
  ownedCache = null
}

export function useOwnedLicenses(beatId: string | undefined) {
  const [ownedLicenses, setOwnedLicenses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (!beatId) {
      setLoading(false)
      return
    }

    ownedCache ??= loadOwnedMap()
    ownedCache
      .then((map) => {
        if (!cancelled) setOwnedLicenses(map.get(beatId) || [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [beatId])

  const isOwned = (licenseType: string) => ownedLicenses.includes(licenseType)

  return { ownedLicenses, isOwned, loading }
}

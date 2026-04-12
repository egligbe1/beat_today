'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useOwnedLicenses(beatId: string | undefined) {
  const [ownedLicenses, setOwnedLicenses] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchOwned() {
      if (!beatId) {
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Query order_items joined with orders to check ownership
      // We check for 'completed' and 'pending' to prevent double-spending during processing
      const { data, error } = await supabase
        .from('order_items')
        .select(`
          license_type,
          orders!inner(status, buyer_id)
        `)
        .eq('beat_id', beatId)
        .eq('orders.buyer_id', user.id)
        .in('orders.status', ['completed', 'pending'])

      if (error) {
        console.error('Error fetching owned licenses:', error)
      } else if (data) {
        setOwnedLicenses(data.map(item => item.license_type))
      }
      setLoading(false)
    }

    fetchOwned()
  }, [beatId])

  const isOwned = (licenseType: string) => ownedLicenses.includes(licenseType)

  return { ownedLicenses, isOwned, loading }
}

'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
type OwnedMap = Map<string,string[]>
let cache: Promise<OwnedMap> | null = null
let revision = 0
let initialized = false
const listeners = new Set<() => void>()
export function invalidateOwnedLicenses() {
  cache = null
  revision++
  listeners.forEach(listener => listener())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!initialized) {
    initialized = true
    createClient().auth.onAuthStateChange(() => invalidateOwnedLicenses())
    window.addEventListener('focus',invalidateOwnedLicenses)
  }
  return () => { listeners.delete(listener) }
}
async function load(): Promise<OwnedMap> {
  const client=createClient()
  const {data:{user}}=await client.auth.getUser()
  const map: OwnedMap=new Map()
  if(!user) return map
  const {data,error}=await client.from('order_items').select('beat_id,license_type,orders!inner(buyer_id,status)')
    .eq('orders.buyer_id',user.id).eq('orders.status','completed')
  if(error) throw error
  for(const item of data || []) map.set(item.beat_id,[...(map.get(item.beat_id)||[]),item.license_type])
  return map
}
export function useOwnedLicenses(beatId: string | undefined) {
  const version=useSyncExternalStore(subscribe,()=>revision,()=>0)
  const [ownedLicenses,setOwned]=useState<string[]>([])
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    let cancelled=false
    setOwned([]);setLoading(true)
    if(!beatId){setLoading(false);return}
    cache ??= load()
    cache.then(map=>{if(!cancelled)setOwned(map.get(beatId)||[])})
      .catch(error=>{cache=null;console.error('Ownership lookup failed',error)})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return ()=>{cancelled=true}
  },[beatId,version])
  return {ownedLicenses,loading,isOwned:(kind:string)=>ownedLicenses.includes(kind)}
}

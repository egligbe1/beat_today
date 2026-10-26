'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Keep requests and agreement status current without interrupting an active form.
export function useStudioRefresh(enabled = true) {
 const router=useRouter()
 useEffect(()=>{
  if(!enabled)return
  const refresh=()=>{if(document.visibilityState==='visible')router.refresh()}
  const timer=setInterval(refresh,30000)
  window.addEventListener('focus',refresh)
  document.addEventListener('visibilitychange',refresh)
  return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
 },[enabled,router])
}

'use client'
import {useEffect,useId,useRef} from 'react'
import {createClient} from '@/lib/supabase/client'
export type LiveScope={table:string;filter?:string}

// Realtime events trigger a fresh authorized read. Periodic catch-up also covers
// missing publication configuration, sleep, lost events and reconnects.
export function useLiveRefresh(refresh:()=>void|Promise<void>, scopes:LiveScope[], enabled=true, intervalMs=5000) {
 const callback=useRef(refresh);callback.current=refresh
 const scopeKey=JSON.stringify(scopes)
 const id=useId()
 useEffect(()=>{
  if(!enabled)return
  let stopped=false,running=false,pending=false
  let debounce:ReturnType<typeof setTimeout>|undefined
  async function sync(){
   if(stopped||document.visibilityState!=='visible'||!navigator.onLine)return
   if(running){pending=true;return}
   running=true
   try{await callback.current()}catch{/* The next visible refresh retries. */}
   finally{running=false;if(pending&&!stopped){pending=false;void sync()}}
  }
  const schedule=()=>{if(!debounce)debounce=setTimeout(()=>{debounce=undefined;void sync()},100)}
  const client=createClient()
  let channel=client.channel('live-refresh:'+id)
  for(const scope of JSON.parse(scopeKey) as LiveScope[])channel=channel.on('postgres_changes',{event:'*',schema:'public',table:scope.table,...(scope.filter?{filter:scope.filter}:{})},schedule)
  channel.subscribe(status=>{if(status==='SUBSCRIBED')void sync()})
  const timer=setInterval(()=>{void sync()},intervalMs)
  window.addEventListener('focus',schedule);window.addEventListener('online',schedule)
  document.addEventListener('visibilitychange',schedule)
  void sync()
  return()=>{stopped=true;clearInterval(timer);if(debounce)clearTimeout(debounce);window.removeEventListener('focus',schedule);window.removeEventListener('online',schedule);document.removeEventListener('visibilitychange',schedule);void client.removeChannel(channel)}
 },[enabled,scopeKey,id,intervalMs])
}

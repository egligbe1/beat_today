'use client'
import {useEffect,useState} from 'react'
import {useRouter} from 'next/navigation'
export default function SuccessPolling({orderId}:{orderId:string}){
 const router=useRouter(),[waiting,setWaiting]=useState(false)
 useEffect(()=>{
  let stopped=false,busy=false,attempts=0
  const controller=new AbortController()
  const check=async()=>{if(stopped||busy)return;busy=true;try{const response=await fetch('/api/purchases/status?order_id='+encodeURIComponent(orderId),{cache:'no-store',signal:controller.signal}),data=await response.json();if(response.ok&&data.status==='completed'){stopped=true;router.refresh()}else if(response.ok&&data.status==='failed'){stopped=true;setWaiting(true)}}catch{}finally{busy=false;if(++attempts>=30){stopped=true;setWaiting(true)}}}
  void check();const timer=setInterval(()=>void check(),3000)
  return()=>{stopped=true;controller.abort();clearInterval(timer)}
 },[orderId,router])
 return <div className="text-sm text-zinc-400"><p role="status">{waiting?'Confirmation is taking longer than usual. If you have paid, keep your payment reference and check again shortly.':'Checking your payment confirmation…'}</p>{waiting&&<button className="text-orange-400 mt-4 font-bold" onClick={()=>router.refresh()}>Check again</button>}</div>
}

'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
export default function ClaimGuestPurchases({automatic=false}:{automatic?:boolean}){
 const started=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 const claim=useCallback(async()=>{setBusy(true);setError('');try{const response=await fetch('/api/purchases/claim',{method:'POST'}),result=await response.json();if(!response.ok)throw new Error(result.error||'Purchases could not be added');setMessage(result.message||'Check your email to confirm your purchases.')}catch(error){setError(error instanceof Error?error.message:'Please try again')}finally{setBusy(false)}},[])
 useEffect(()=>{if(automatic&&!started.current){started.current=true;void claim()}},[automatic,claim])
 return <section className="rounded-2xl border border-white/10 p-5 text-sm"><h2 className="font-bold">Bought as a guest?</h2><p className="text-zinc-400 mt-2">Add completed purchases made with your verified account email. Your original license terms stay the same.</p><button disabled={busy} onClick={claim} className="text-orange-400 font-bold mt-4">{busy?'Finding purchases…':'Add my guest purchases'}</button>{message&&<p role="status" className="text-zinc-300 mt-3">{message}</p>}{error&&<p role="alert" className="text-red-300 mt-3">{error}</p>}</section>
}

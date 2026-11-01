import Link from 'next/link'
import {notFound} from 'next/navigation'
import {createAdminClient} from '@/lib/supabase/admin'
import {getCachedAuthContext} from '@/lib/auth'
import {isOperator,operationalCounts} from '@/lib/operations'
import PaymentCaseReview from '@/components/operations/PaymentCaseReview'
export const dynamic='force-dynamic'
export default async function OperationsPage({searchParams}:{searchParams:Promise<{view?:string}>}){
 const {user}=await getCachedAuthContext()
 if(!isOperator(user?.id))notFound()
 const view=(await searchParams).view==='all'?'all':'open',db=createAdminClient()
 let query=db.from('payment_cases').select('*',{count:'exact'}).order('updated_at',{ascending:false}).limit(50)
 if(view==='open')query=query.eq('state','OPEN')
 const [result,counts]=await Promise.all([query,operationalCounts(db)])
 if(result.error)throw new Error('Payment cases could not be loaded')
 const cases=result.data||[],ids=cases.map(item=>item.id)
 const events=ids.length?await db.from('payment_case_events').select('case_id,event_type,summary,created_at').in('case_id',ids).order('created_at',{ascending:false}).limit(250):{data:[],error:null}
 if(events.error)throw new Error('Case history could not be loaded')
 return <div className="max-w-5xl mx-auto space-y-7">
  <header><p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Private operations</p><h1 className="mt-3 text-3xl font-bold">Payments & delivery review</h1><p className="text-zinc-400 text-sm mt-3">Open payment cases pause affected payouts. Unmatched cases pause all new payouts until reviewed. Existing transfers may already be in progress.</p></header>
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{Object.entries(counts).map(([key,value])=><div key={key} className="p-4 rounded-xl border border-white/10 bg-[#111]"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-zinc-400 mt-2">{({pending_deliveries:'Pending license emails',failed_deliveries:'Failed license emails',failed_watermarks:'Failed previews',stale_watermark_leases:'Stale preview jobs',recorded_payment_exceptions:'Recorded settlement exceptions',open_payment_cases:'Open payment cases'} as Record<string,string>)[key]}</p></div>)}</div>
  <p className="text-xs text-zinc-500">Settlement exceptions include historical records. Review provider logs for time-sensitive disputes; this page does not submit evidence to Paystack.</p>
  <nav className="flex gap-5 text-sm"><Link href="/dashboard/operations" className={view==='open'?'text-orange-400':'text-zinc-400'}>Open cases</Link><Link href="/dashboard/operations?view=all" className={view==='all'?'text-orange-400':'text-zinc-400'}>Recent history</Link></nav>
  <p className="text-xs text-zinc-500">Showing {cases.length} of {result.count||0} cases, most recently updated first.</p>
  {!cases.length&&<p className="rounded-xl border border-white/10 p-6 text-zinc-400">No {view==='open'?'open ':''}payment cases.</p>}
  {cases.map(item=><section key={item.id} className="p-5 rounded-2xl border border-white/10 bg-[#111] space-y-4"><div className="flex justify-between gap-4"><h2 className="font-bold">{item.kind==='REFUND'?'Refund':'Dispute'} · {item.state==='OPEN'?'Needs review':'Reviewed'}</h2><span className="text-xs text-zinc-500">{new Date(item.updated_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC</span></div><p className="text-sm text-zinc-300 break-all">Payment reference: {item.reference||'Unmatched — all new payouts paused'}</p><p className="text-xs text-zinc-400">Latest provider event: {item.last_event}{item.amount_minor!==null?` · Event amount: ${item.currency||'unknown currency'} ${(Number(item.amount_minor)/100).toFixed(2)}`:''}. This is the latest event amount, not a calculated refund total.</p><details className="text-xs text-zinc-400"><summary className="cursor-pointer">Recent case history</summary><ol className="mt-3 space-y-3">{(events.data||[]).filter(event=>event.case_id===item.id).slice(0,5).map((event,index)=><li key={index} className="border-l border-white/10 pl-3"><p>{event.event_type} · {new Date(event.created_at).toISOString()}</p>{event.summary?.note&&<p className="mt-2 whitespace-pre-wrap">{event.summary.note}</p>}</li>)}</ol></details>{item.state==='OPEN'&&<PaymentCaseReview caseId={item.id}/>}</section>)}
 </div>
}

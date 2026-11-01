import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createClient} from '@supabase/supabase-js'
import {calendarBookingsQuery,studioDayBounds,pageRange} from '../lib/studio/calendar.ts'
test('selected-day calendar query retrieves its sessions despite over 200 later records and paginates without crossing studios',async()=>{
 const records=[...Array.from({length:350},(_,i)=>({id:'future-'+i,producer_id:'producer',studio_id:'studio',starts_at:'2026-12-01T12:00:00Z',status:'CONFIRMED'})),...Array.from({length:32},(_,i)=>({id:'today-'+String(i).padStart(2,'0'),producer_id:'producer',studio_id:'studio',starts_at:'2026-11-01T12:00:00Z',status:'CONFIRMED'})),{id:'private',producer_id:'other',studio_id:'another',starts_at:'2026-11-01T12:00:00Z',status:'CONFIRMED'}]
 const calls=[]
 const client=createClient('http://isolated.invalid','isolated',{auth:{persistSession:false},global:{fetch:async input=>{
  const url=new URL(input),p=url.searchParams;calls.push(url)
  assert.equal(p.get('producer_id'),'eq.producer');assert.equal(p.get('studio_id'),'eq.studio')
  const filters=p.getAll('starts_at'),start=filters.find(v=>v.startsWith('gte.'))?.slice(4),end=filters.find(v=>v.startsWith('lt.'))?.slice(3)
  assert.ok(start&&end,'date filtering must happen before pagination')
  const eligible=records.filter(row=>row.producer_id==='producer'&&row.studio_id==='studio'&&Date.parse(row.starts_at)>=Date.parse(start)&&Date.parse(row.starts_at)<Date.parse(end)).sort((a,b)=>a.id.localeCompare(b.id))
  const offset=Number(p.get('offset')||0),limit=Number(p.get('limit')||1000)
  return new Response(JSON.stringify(eligible.slice(offset,offset+limit)),{headers:{'content-type':'application/json','content-range':`${offset}-${Math.min(offset+limit,eligible.length)-1}/${eligible.length}`}})
 }}})
 const page=number=>{const range=pageRange(number);return calendarBookingsQuery(client,'producer','studio',studioDayBounds('2026-11-01','Africa/Accra')).range(range.from,range.to)}
 const first=await page(1),second=await page(2)
 assert.equal(first.error,null);assert.equal(first.count,32);assert.equal(first.data.length,25)
 assert.equal(second.data.length,7);assert.equal(new Set([...first.data,...second.data].map(row=>row.id)).size,32)
 assert.ok(first.data.every(row=>row.id.startsWith('today-')))
 assert.equal(calls.length,2)
})

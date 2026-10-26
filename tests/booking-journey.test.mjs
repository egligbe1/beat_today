import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authReturnTo, requestedAuthReturn } from '../lib/authReturn.ts'
import { validBookingDay, bookingSetup, nextBookingDay, reservationExpired } from '../lib/studio/booking.ts'

test('booking sign-in returns to the local studio through password, OAuth and onboarding',()=>{
 const studio='/studio/producer?service=recording&day=2026-10-28'
 assert.equal(requestedAuthReturn('?redirect='+encodeURIComponent(studio)),studio)
 assert.equal(requestedAuthReturn('?next='+encodeURIComponent(studio)),studio)
 assert.equal(requestedAuthReturn('','/dashboard'),'/dashboard')
 for(const value of ['https://evil.example','//evil.example','/\\evil.example','/%2f%2fevil.example','/%255cevil.example','/%25255cevil.example','/\nevil.example','/login','/api/auth/callback','/%']) assert.equal(authReturnTo(value), '/', value)
})
test('setup requires an active service in an owned room with enough time for both buffers',()=>{
 const rooms=[{id:'room'}], services=[{room_id:'room',is_active:true,duration_minutes:60,buffer_minutes:15}]
 const hours=[{room_id:'room',opens:'09:00',closes:'10:30',closed:false}]
 assert.equal(bookingSetup(rooms,services,hours).ready,true)
 assert.equal(bookingSetup([],services,hours).ready,false)
 assert.equal(bookingSetup(rooms,[{...services[0],is_active:false}],hours).ready,false)
 assert.equal(bookingSetup(rooms,services,[{...hours[0],closed:true}]).ready,false)
 assert.equal(bookingSetup(rooms,services,[{...hours[0],closes:'10:29'}]).ready,false)
 assert.equal(bookingSetup(rooms,services,[{...hours[0],room_id:'other'}]).ready,false)
})
test('available-day search is bounded, respects horizon, stops on success and aborts',async()=>{
 const days=[]
 assert.equal(await nextBookingDay('2026-10-26','2026-11-26',async day=>{days.push(day);return day==='2026-10-28'?['time']:[]},new AbortController().signal),'2026-10-28')
 assert.deepEqual(days,['2026-10-27','2026-10-28'])
 let calls=0
 assert.equal(await nextBookingDay('2026-10-26','2026-11-26',async()=>{calls++;return []},new AbortController().signal),null)
 assert.equal(calls,7)
 calls=0
 await nextBookingDay('2026-10-26','2026-10-27',async()=>{calls++;return []},new AbortController().signal)
 assert.equal(calls,1)
 const controller=new AbortController()
 assert.equal(await nextBookingDay('2026-10-26','2026-11-26',async()=>{controller.abort();return ['time']},controller.signal),null)
 await assert.rejects(nextBookingDay('2026-10-26','2026-11-26',async()=>{throw new Error('offline')},new AbortController().signal),/offline/)
})
test('invalid calendar dates and expired reservations are not actionable',()=>{
 assert.equal(validBookingDay('2028-02-29'),true)
 for(const day of ['2026-02-29','2026-04-31','2026-13-01','not-a-date','2026-1-2'])assert.equal(validBookingDay(day),false)
 const now=Date.parse('2026-10-26T12:00:00Z')
 const booking={status:'RESERVED',starts_at:'2026-10-28T12:00:00Z',reserved_until:'2026-10-27T12:00:00Z'}
 assert.equal(reservationExpired(booking,now),false)
 assert.equal(reservationExpired({...booking,reserved_until:'2026-10-26T12:00:00Z'},now),true)
 assert.equal(reservationExpired({...booking,starts_at:'2026-10-26T12:00:00Z'},now),true)
 assert.equal(reservationExpired({...booking,status:'CONFIRMED'},now),false)
})

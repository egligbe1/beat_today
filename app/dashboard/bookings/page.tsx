import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCachedAuthContext } from '@/lib/auth'
import { artistBookings } from '@/lib/studio/bookingData'
import BookingList from '@/components/studio/BookingList'
export default async function MyBookingsPage(){
 const {user}=await getCachedAuthContext()
 if(!user)redirect('/login')
 const data=await artistBookings(user.id)
 return <div className="max-w-5xl mx-auto space-y-7"><header className="rounded-3xl border border-white/10 bg-[#111] p-7 md:p-9"><p className="text-[10px] uppercase tracking-[.25em] text-orange-400 font-bold">Your studio sessions</p><h1 className="text-3xl md:text-4xl font-black mt-4">My Bookings</h1><p className="text-sm text-zinc-500 mt-4">Follow your requests, confirm agreements, and keep your session details in one place.</p><Link href="/dashboard/projects" className="text-xs text-orange-400 inline-block mt-5">Open my projects →</Link></header>{data.unavailable?<p className="text-sm text-zinc-400">Studio bookings are being prepared. Existing projects and agreements remain available.</p>:<BookingList bookings={data.bookings}/>}<p className="text-xs text-zinc-600">To request a session, open a producer’s published studio booking page.</p></div>
}

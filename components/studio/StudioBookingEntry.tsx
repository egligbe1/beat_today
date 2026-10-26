import Link from 'next/link'
import ContactButton from '@/components/profile/ContactButton'
import type { StudioBookingCatalog } from '@/lib/types'

export default function StudioBookingEntry({ profile, catalog, owner = false }: {
 profile: { id: string; handle: string }
 catalog: StudioBookingCatalog | null
 owner?: boolean
}) {
 const available = !!catalog?.is_public && catalog.services.length > 0
 const button = 'inline-flex min-h-12 items-center justify-center text-center rounded-xl px-6 py-3 font-bold bg-[#FF5500] text-white w-full sm:w-auto'
 return <section aria-label="Studio booking" className="rounded-3xl border border-white/10 bg-[#111] p-6 md:p-8">
  <h2 className="text-2xl font-bold">Book a studio session</h2>
  <p className="text-zinc-400 text-sm leading-relaxed mt-3 max-w-3xl">{available
   ? 'Choose a service and time, then send a session request. The producer reserves the time before you confirm a shared agreement. A request does not hold a slot or take payment.'
   : owner
    ? 'Your studio is not open for online session requests yet. Finish your booking setup and publish it when you are ready to accept requests.'
    : 'Online session requests are not available for this producer right now. Contact the producer to ask about studio sessions. No time or price is confirmed here.'}</p>
  <div className="mt-5">{owner
   ? <Link href="/dashboard/studio" className={button}>Manage studio booking</Link>
   : available
    ? <Link href={`/studio/${encodeURIComponent(profile.handle)}`} className={button}>Book studio — choose service &amp; time</Link>
    : <ContactButton initialMessage="Hi! I’d like to ask about booking a studio session." producerId={profile.id} className="justify-center w-full sm:w-auto" />}</div>
  {owner && <p className="text-xs text-zinc-500 mt-4">Configure rooms, services and opening hours in your studio dashboard. Public booking requires active PRO and your explicit publication.</p>}
 </section>
}

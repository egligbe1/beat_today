import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { bookingCatalog } from '@/lib/studio/bookingData'
import BookingRequest from '@/components/studio/BookingRequest'
export default async function StudioBookingPage({ params }: { params: Promise<{ handle: string }> }) {
 const { handle } = await params
 const catalog = await bookingCatalog(handle.replace(/^@/, ''))
 if (!catalog || !catalog.is_public) notFound()
 const db = await createClient()
 const { data: { user } } = await db.auth.getUser()
 return <div className="max-w-6xl mx-auto p-5 md:p-10"><BookingRequest catalog={catalog} signedIn={!!user} owner={user?.id === catalog.owner_id} /></div>
}

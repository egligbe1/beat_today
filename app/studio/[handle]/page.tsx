import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { profileBookingCatalog } from '@/lib/studio/bookingData'
import BookingRequest from '@/components/studio/BookingRequest'
import StudioBookingEntry from '@/components/studio/StudioBookingEntry'
export default async function StudioBookingPage({ params }: { params: Promise<{ handle: string }> }) {
 const { handle } = await params
 const cleanHandle = handle.replace(/^@/, '')
 const db = await createClient()
 const { data: profile, error } = await db.from('users_profiles').select('id,handle,role').eq('handle', cleanHandle).maybeSingle()
 if (error) throw new Error('Producer profile could not be loaded')
 if (!profile || profile.role !== 'producer') notFound()
 const catalog = await profileBookingCatalog(cleanHandle)
 const { data: { user } } = await db.auth.getUser()
 if (!catalog?.is_public || !catalog.services.length) return <div className="max-w-6xl mx-auto p-5 md:p-10 space-y-6">
  <Link href={`/${encodeURIComponent(profile.handle)}`} className="text-sm text-zinc-400 hover:text-white">Back to producer profile</Link>
  <StudioBookingEntry profile={profile} catalog={catalog} owner={user?.id === profile.id} />
 </div>
 return <div className="max-w-6xl mx-auto p-5 md:p-10"><BookingRequest catalog={catalog} signedIn={!!user} owner={user?.id === catalog.owner_id} /></div>
}

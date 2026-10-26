import { redirect } from 'next/navigation'
import { getCachedAuthContext } from '@/lib/auth'
import { studioHome } from '@/lib/studio/data'
import { bookingCatalog, bookingWorkspace } from '@/lib/studio/bookingData'
import StudioHome from '@/components/studio/StudioHome'
import BookingDashboard from '@/components/studio/BookingDashboard'
export default async function StudioPage() {
 const { user, profile } = await getCachedAuthContext()
 if (!user) redirect('/login')
 if (profile?.role !== 'producer') redirect('/dashboard/bookings')
 const data = await studioHome(user.id)
 if (!data.workspace) return <StudioHome {...data} producer />
 const catalog = await bookingCatalog(profile.handle)
 const bookings = catalog ? await bookingWorkspace(user.id,data.workspace.id,catalog.today) : null
 if (!catalog || !bookings) return <><p className="text-sm text-zinc-400 mb-5">Studio bookings are being prepared. Your existing projects remain available.</p><StudioHome {...data} producer /></>
 return <BookingDashboard {...bookings} workspace={data.workspace} catalog={catalog} isPro={data.isPro}/>
}

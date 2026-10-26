import { redirect } from 'next/navigation'
import { getCachedAuthContext } from '@/lib/auth'
import { studioHome } from '@/lib/studio/data'
import StudioHome from '@/components/studio/StudioHome'
export default async function StudioPage() {
  const { user, profile } = await getCachedAuthContext()
  if (!user) redirect('/login')
  if (profile?.role !== 'producer') redirect('/dashboard/projects')
  const data = await studioHome(user.id)
  return <StudioHome {...data} producer />
}

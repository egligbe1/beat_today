import { redirect } from 'next/navigation'
import { getCachedAuthContext } from '@/lib/auth'
import { studioHome } from '@/lib/studio/data'
import StudioHome from '@/components/studio/StudioHome'
export default async function ProjectsPage() {
  const { user } = await getCachedAuthContext()
  if (!user) redirect('/login')
  const data = await studioHome(user.id)
  return <StudioHome {...data} producer={false} />
}

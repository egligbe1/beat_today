import { notFound, redirect } from 'next/navigation'
import { getCachedAuthContext } from '@/lib/auth'
import { studioProject } from '@/lib/studio/data'
import { UUID_RE } from '@/lib/security'
import ProjectWorkspace from '@/components/studio/ProjectWorkspace'
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { user } = await getCachedAuthContext()
  if (!user) redirect('/login')
  const { projectId } = await params
  if (!UUID_RE.test(projectId)) notFound()
  const data = await studioProject(projectId, user.id)
  if (!data) notFound()
  if (data.unavailable) return <div className="p-8">Studio workspace is being prepared. Please check back shortly.</div>
  return <ProjectWorkspace {...data} userId={user.id} />
}

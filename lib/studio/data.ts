import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { StudioWorkspace, StudioProject, StudioAgreement, StudioEvent, StudioMilestone, StudioBooking } from '@/lib/types'
import { effectiveTier } from '@/lib/security'
import { missingStudioSchema } from './domain'

export async function studioHome(userId: string) {
  const db = await createClient()
  const [workspace, projects, settings] = await Promise.all([
    db.from('studio_workspaces').select('id,owner_id,name,city,timezone').eq('owner_id', userId).maybeSingle(),
    db.from('studio_projects').select('*').order('updated_at', { ascending: false }).limit(100),
    db.from('producer_settings').select('subscription_tier,subscription_active,subscription_expires_at').eq('user_id', userId).maybeSingle(),
  ])
  const unavailable = missingStudioSchema(workspace.error) || missingStudioSchema(projects.error)
  if (!unavailable && (workspace.error || projects.error || settings.error)) throw new Error('Studio workspace could not be loaded')
  return { workspace: workspace.data as StudioWorkspace | null, projects: (projects.data || []) as StudioProject[], isPro: effectiveTier(settings.data) === 'PRO', unavailable }
}

export async function studioProject(id: string, userId: string) {
  const db = await createClient()
  const project = await db.from('studio_projects').select('*').eq('id', id).maybeSingle()
  if (missingStudioSchema(project.error)) return { unavailable: true as const }
  if (project.error) throw new Error('Project could not be loaded')
  if (!project.data) return null
  const p = project.data as StudioProject
  const [workspace, agreements, events, milestones, profiles, booking, settings] = await Promise.all([
    db.from('studio_workspaces').select('id,owner_id,name,city,timezone').eq('id', p.studio_id).single(),
    db.from('studio_agreements').select('*').eq('project_id', id).order('version', { ascending: false }),
    db.from('studio_project_events').select('*').eq('project_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100),
    db.from('studio_project_milestones').select('*').eq('project_id', id).order('created_at'),
    db.from('users_profiles').select('id,handle,display_name,avatar_url').in('id', [p.producer_id, p.artist_id]),
    db.from('studio_bookings').select('*').eq('project_id', id).maybeSingle(),
    p.producer_id === userId ? db.from('producer_settings').select('subscription_tier,subscription_active,subscription_expires_at').eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  if ([workspace, agreements, events, milestones, profiles, settings].some(r => r.error) || (booking.error && !missingStudioSchema(booking.error))) throw new Error('Project details could not be loaded')
  return {
    unavailable: false as const, project: p, workspace: workspace.data as StudioWorkspace,
    agreements: (agreements.data || []) as StudioAgreement[], events: (events.data || []) as StudioEvent[],
    milestones: (milestones.data || []) as StudioMilestone[], profiles: profiles.data || [], booking: booking.data as StudioBooking | null,
    isPro: effectiveTier(settings.data) === 'PRO',
  }
}

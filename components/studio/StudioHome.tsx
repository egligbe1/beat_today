'use client'
import { useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Plus, Music2, ArrowRight, Building2, CheckCircle2, FileText, Clock3, Search, Layers3 } from 'lucide-react'
import type { StudioWorkspace, StudioProject } from '@/lib/types'
import { PROJECT_STAGE, STUDIO_SERVICES } from '@/lib/studio/domain'

export const studioInput = 'w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/60 transition-colors'
export const studioButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#FF5500] px-5 py-3 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-40 disabled:cursor-wait transition-colors'
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block space-y-2"><span className="text-xs font-bold text-zinc-300">{label}</span>{children}{hint && <span className="block text-xs leading-relaxed text-zinc-500">{hint}</span>}</label>
}
export async function studioAction(action: string, payload: Record<string, unknown>, project_id?: string) {
  const response = await fetch('/api/studio/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, payload, project_id }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Could not save this change')
  return result as { id: string }
}
export function Stage({ status }: { status: StudioProject['status'] }) {
  return <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg ${status === 'IN_PRODUCTION' ? 'bg-orange-500/10 text-orange-400' : status === 'AGREED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-zinc-400'}`}><span className="w-1 h-1 rounded-full bg-current" />{PROJECT_STAGE[status]}</span>
}
export default function StudioHome({ workspace, projects, isPro, producer, unavailable = false }: {
  workspace: StudioWorkspace | null; projects: StudioProject[]; isPro: boolean; producer: boolean; unavailable?: boolean
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault(); setError(''); setBusy(true)
    const data = Object.fromEntries(new FormData(event.currentTarget))
    try {
      const result = await studioAction(action, data)
      if (action === 'create_project') router.push(`/dashboard/projects/${result.id}`)
      else router.refresh()
      setCreating(false)
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again') }
    finally { setBusy(false) }
  }
  const owned = producer ? projects.filter(p => p.producer_id === workspace?.owner_id) : projects
  const visible = owned.filter(p => `${p.title} ${p.service_type}`.toLowerCase().includes(search.toLowerCase()))
  const canCreate = producer && isPro && !!workspace && !unavailable
  return <div className="max-w-7xl mx-auto space-y-8">
    <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] px-6 py-8 md:p-10">
      <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-orange-600/10 blur-[90px] pointer-events-none" />
      <div className="relative flex flex-col md:flex-row justify-between gap-6">
        <div><div className="flex items-center gap-2 text-[10px] uppercase tracking-[.25em] text-orange-400 font-bold mb-5"><Layers3 className="w-4 h-4" />{producer ? 'BeatToday Studio · PRO workspace' : 'Your creative workspace'}</div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">{producer ? workspace?.name || 'Your studio. Connected' : 'My Projects'}<span className="text-[#FF5500]">.</span></h1>
          <p className="mt-4 text-sm text-zinc-400 leading-relaxed max-w-xl">{producer ? workspace ? 'Bring your artists, agreements and production milestones into one shared workspace.' : 'Publish your services, open your calendar and accept session requests. Agreements and projects stay connected to each booking.' : 'Review agreements, follow production and stay in conversation with your producers.'}</p>
          {workspace && <p className="mt-5 text-xs text-zinc-500 flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{[workspace.city, workspace.timezone.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</p>}
        </div>
        <div className="flex items-start gap-3">{canCreate && <button className={studioButton} onClick={() => setCreating(!creating)}><Plus className="w-4 h-4" />New project</button>}{producer && !isPro && <Link href="/dashboard/subscription" className={studioButton}>Explore PRO<ArrowUpRight className="w-4 h-4" /></Link>}</div>
      </div>
    </header>
    {error && <p role="alert" className="p-4 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 text-sm">{error}</p>}
    {unavailable ? <section className="rounded-2xl border border-white/10 p-8"><h2 className="font-bold text-xl">Studio workspace is being prepared</h2><p className="text-zinc-400 text-sm mt-2">Your existing store and purchases are available as usual. Your studio will appear here when it is ready.</p></section> : <>
      {producer && !isPro && <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5 text-sm text-zinc-300">New studios and projects are included with an active PRO subscription.{workspace && ' You can continue working on your existing projects and agreements.'}</div>}
      {producer && isPro && !workspace && <section className="grid lg:grid-cols-2 gap-8 p-6 md:p-8 border border-white/10 rounded-2xl bg-[#101010]">
        <div><span className="text-xs uppercase tracking-widest text-orange-400">Welcome to your studio</span><h2 className="text-2xl font-bold mt-3">Give your studio a calendar.</h2><p className="text-zinc-400 text-sm leading-relaxed mt-3">Set up your studio, add rooms and session services, and share your booking page. Each reserved session connects to an agreement and project.</p><ul className="mt-6 space-y-3 text-sm text-zinc-300">{['A public booking page for your studio','Room availability and session requests','Agreements and projects linked to each booking'].map(x => <li key={x} className="flex gap-3"><CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0" />{x}</li>)}</ul></div>
        <form onSubmit={e => submit(e, 'create_studio')} className="space-y-4"><Field label="Studio name"><input name="name" required minLength={2} maxLength={100} placeholder="Your studio or production business" className={studioInput} /></Field><Field label="City"><input name="city" maxLength={100} placeholder="Accra" className={studioInput} /></Field><Field label="Studio timezone"><select name="timezone" className={studioInput} defaultValue="Africa/Accra">{['Africa/Accra','Africa/Lagos','Africa/Johannesburg','Africa/Nairobi','Europe/London','America/New_York','America/Los_Angeles','Europe/Paris','Asia/Dubai'].map(t => <option key={t}>{t}</option>)}</select></Field><button disabled={busy} className={studioButton}>{busy ? 'Creating…' : 'Create studio'}<ArrowRight className="w-4 h-4" /></button></form>
      </section>}
      {creating && canCreate && <section className="p-6 border border-orange-500/25 rounded-2xl bg-[#111]">
        <div className="flex justify-between gap-4 mb-5"><div><h2 className="font-bold text-xl">Start a project</h2><p className="text-zinc-500 text-sm mt-1">The artist will see the project in their BeatToday dashboard.</p></div><button onClick={() => setCreating(false)} className="text-xs text-zinc-400">Close</button></div>
        <form onSubmit={e => submit(e, 'create_project')} className="grid md:grid-cols-2 gap-4">
          <Field label="Project name"><input name="title" required minLength={2} maxLength={160} className={studioInput} placeholder="EP mixing · 3 tracks" /></Field>
          <Field label="Artist’s BeatToday handle" hint="Use their registered handle. They can review the project as soon as it is created."><input name="artist_handle" required maxLength={100} className={studioInput} placeholder="@artist" autoCapitalize="none" /></Field>
          <Field label="Type of work"><select name="service_type" className={studioInput}>{STUDIO_SERVICES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}</select></Field>
          <div className="md:col-span-2"><Field label="Project brief"><textarea name="brief" required minLength={10} maxLength={8000} rows={3} className={studioInput} placeholder="What are you creating together? Describe the sound, goals and work involved." /></Field></div>
          <div className="md:col-span-2 flex justify-end"><button disabled={busy} className={studioButton}>{busy ? 'Opening…' : 'Create shared project'}<ArrowRight className="w-4 h-4" /></button></div>
        </form>
      </section>}
      {(!producer || !!workspace) && <><div className="grid grid-cols-3 gap-3 md:gap-5">{[
        { label: 'Projects', value: owned.length, icon: Layers3 },
        { label: 'Awaiting agreement', value: owned.filter(p => p.status === 'AWAITING_AGREEMENT').length, icon: FileText },
        { label: 'In production', value: owned.filter(p => p.status === 'IN_PRODUCTION').length, icon: Music2 },
      ].map(({ label, value, icon: Icon }) => <div className="rounded-2xl bg-[#111] border border-white/[.07] p-4 md:p-6" key={label}><Icon className="text-zinc-500 w-4 h-4 mb-4" /><p className="font-bold text-3xl tabular-nums">{value}</p><p className="text-[11px] md:text-xs text-zinc-500 mt-2">{label}</p></div>)}</div>
      <section><div className="flex flex-col sm:flex-row justify-between gap-4 mb-5"><h2 className="font-bold text-xl">{producer ? 'Studio projects' : 'Your projects'}</h2><label className="flex items-center gap-2 border border-white/10 rounded-xl px-3 py-2 text-zinc-500"><Search className="w-4 h-4" /><input aria-label="Find a project" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a project" className="bg-transparent outline-none text-xs text-white w-40" /></label></div>
        {visible.length ? <div className="grid lg:grid-cols-2 gap-4">{visible.map(p => <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="group bg-[#111] border border-white/[.08] hover:border-orange-500/30 p-5 md:p-6 rounded-2xl transition-colors"><div className="flex justify-between items-start gap-4"><div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center"><Music2 className="w-5 h-5" /></div><Stage status={p.status} /></div><h3 className="text-lg font-bold mt-5 group-hover:text-orange-300 transition-colors">{p.title}</h3><p className="text-sm text-zinc-500 line-clamp-2 mt-2 leading-relaxed">{p.brief}</p><div className="mt-6 flex items-center justify-between"><span className="text-[10px] uppercase tracking-widest text-zinc-500">{p.service_type}</span><span className="text-xs text-zinc-400 flex items-center gap-2">Open workspace<ArrowUpRight className="w-4 h-4" /></span></div></Link>)}</div> : <div className="border border-dashed border-white/10 rounded-2xl p-10 text-center"><Clock3 className="w-8 h-8 text-zinc-600 mx-auto mb-4" /><h3 className="font-bold">{search ? 'No matching projects' : 'Your next collaboration starts here'}</h3><p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">{search ? 'Try another project name.' : producer ? 'Create a project to bring an artist, an agreement and your production milestones together.' : 'Projects appear here when a producer opens a shared workspace with you.'}</p></div>}
        {owned.length === 100 && <p className="text-xs text-zinc-500 mt-3">Showing the 100 most recently updated projects.</p>}
      </section></>}
    </>}
  </div>
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Info, AlertCircle, CheckCircle2 } from 'lucide-react'
import { LICENSE_DEFAULTS } from '@/lib/utils/licenseGenerator'

const LICENSE_TYPES = [
  { id: 'basic', name: 'Basic Lease', desc: 'Standard MP3 license for new artists.' },
  { id: 'premium', name: 'Premium Lease', desc: 'High-quality WAV license with more rights.' },
  { id: 'unlimited', name: 'Unlimited Lease', desc: 'Unlimited streams and distribution.' },
  { id: 'exclusive', name: 'Exclusive Rights', desc: 'Full ownership transfer to the buyer.' },
]

export default function LicensesDashboard() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadTemplates() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('license_templates')
        .select('*')
        .eq('producer_id', user.id)

      if (data) setTemplates(data)
      setLoading(false)
    }
    loadTemplates()
  }, [supabase])

  const handleUpdate = async (type: string, updates: any) => {
    setSaving(type)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    const currentTemplate = templates.find(t => t.type === type)
    const baseTemplate = LICENSE_TYPES.find(l => l.id === type)

    const defaults = LICENSE_DEFAULTS[type]
    const { error: err } = await supabase
      .from('license_templates')
      .upsert({
        producer_id: user?.id,
        type,
        name: currentTemplate?.name || baseTemplate?.name || 'License',
        streaming_limit: currentTemplate?.streaming_limit ?? defaults?.streaming_limit ?? 50000,
        music_video_limit: currentTemplate?.music_video_limit ?? defaults?.music_video_limit ?? 1,
        radio_broadcasting: currentTemplate?.radio_broadcasting ?? defaults?.radio_broadcasting ?? false,
        contract_text: currentTemplate?.contract_text || defaults?.contract_text || '',
        ...updates,
        updated_at: new Date().toISOString()
      }, { onConflict: 'producer_id, type' })

    if (err) {
      setError(err.message)
    } else {
      setTemplates(prev => prev.map(t => t.type === type ? { ...t, ...updates } : t))
    }
    setSaving(null)
  }

  if (loading) {
    return <div className="p-8 text-center text-text-muted animate-pulse">Loading templates...</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black uppercase tracking-tight flex items-center gap-3">
           <FileText className="w-10 h-10 text-[#FF5500]" />
           License Management
        </h1>
        <p className="text-text-muted text-lg max-w-2xl">
          Customize the legal terms for your beats. These agreements are automatically populated and emailed to buyers upon purchase.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-500 font-bold">
           <AlertCircle className="w-5 h-5" />
           {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {LICENSE_TYPES.map((lt) => {
          const defaults = LICENSE_DEFAULTS[lt.id]
          const template = templates.find(t => t.type === lt.id) || {
            name: lt.name,
            streaming_limit: defaults?.streaming_limit ?? 50000,
            music_video_limit: defaults?.music_video_limit ?? 1,
            radio_broadcasting: defaults?.radio_broadcasting ?? false,
            contract_text: defaults?.contract_text ?? ''
          }

          return (
            <div key={lt.id} className="bg-bg-surface border border-border-subtle rounded-3xl overflow-hidden shadow-2xl transition-all hover:border-[#FF5500]/30 group">
              <div className="p-8 flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3 space-y-4">
                   <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#FF5500]">License Type</span>
                      <h2 className="text-2xl font-black uppercase">{lt.name}</h2>
                      <p className="text-sm text-text-muted font-medium">{lt.desc}</p>
                   </div>

                   <div className="bg-bg-primary/50 p-4 rounded-2xl border border-white/5 space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Terms Preview</h4>
                      <ul className="space-y-2 text-xs font-bold">
                         <li className="flex items-center gap-2">
                            <span className="text-[#FF5500]">●</span> {template.streaming_limit === 0 ? 'Unlimited' : template.streaming_limit.toLocaleString()} Streams
                         </li>
                         <li className="flex items-center gap-2">
                            <span className="text-[#FF5500]">●</span> {template.music_video_limit === 0 ? 'Unlimited' : template.music_video_limit} Music Video(s)
                         </li>
                         <li className="flex items-center gap-2">
                            <span className="text-[#FF5500]">●</span> {template.radio_broadcasting ? 'Radio Rights Included' : 'No Radio Rights'}
                         </li>
                      </ul>
                   </div>
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-white/[0.02] rounded-3xl border border-white/5">
                   <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-text-muted">Streaming Limit</label>
                      <input
                        type="number"
                        className="w-full h-12 bg-bg-primary border border-border-subtle rounded-xl px-4 font-bold focus:ring-[#FF5500] focus:border-[#FF5500] transition-all"
                        defaultValue={template.streaming_limit}
                        onChange={(e) => handleUpdate(lt.id, { streaming_limit: parseInt(e.target.value) })}
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-text-muted">Music Videos</label>
                      <input
                        type="number"
                        className="w-full h-12 bg-bg-primary border border-border-subtle rounded-xl px-4 font-bold focus:ring-[#FF5500] focus:border-[#FF5500] transition-all"
                        defaultValue={template.music_video_limit}
                        onChange={(e) => handleUpdate(lt.id, { music_video_limit: parseInt(e.target.value) })}
                      />
                   </div>
                   <div className="sm:col-span-2 flex items-center justify-between p-4 bg-bg-primary rounded-xl border border-border-subtle">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold">Radio Broadcasting Rights</h4>
                        <p className="text-xs text-text-muted">Allow the artist to play this track on FM/Web radio.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={template.radio_broadcasting}
                        className="w-6 h-6 rounded-md border-border-subtle text-[#FF5500] focus:ring-[#FF5500]"
                        onChange={(e) => handleUpdate(lt.id, { radio_broadcasting: e.target.checked })}
                      />
                   </div>

                   <div className="sm:col-span-2 space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-text-muted">Contract Text</label>
                      <textarea
                        className="w-full h-64 bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 font-mono text-xs text-text-muted focus:ring-[#FF5500] focus:border-[#FF5500] transition-all resize-y"
                        defaultValue={template.contract_text}
                        onChange={(e) => handleUpdate(lt.id, { contract_text: e.target.value })}
                      />
                      <p className="text-[10px] text-text-muted">Use <code className="text-[#FF5500]">&#123;&#123;PRODUCER_NAME&#125;&#125;</code>, <code className="text-[#FF5500]">&#123;&#123;BUYER_NAME&#125;&#125;</code>, <code className="text-[#FF5500]">&#123;&#123;TRACK_TITLE&#125;&#125;</code>, <code className="text-[#FF5500]">&#123;&#123;STREAM_LIMIT&#125;&#125;</code>, <code className="text-[#FF5500]">&#123;&#123;MV_LIMIT&#125;&#125;</code>, <code className="text-[#FF5500]">&#123;&#123;RADIO_RIGHTS&#125;&#125;</code>, <code className="text-[#FF5500]">&#123;&#123;DATE&#125;&#125;</code> as dynamic placeholders.</p>
                   </div>

                   <div className="sm:col-span-2 flex justify-end items-center gap-4">
                      {saving === lt.id && (
                        <span className="text-xs text-text-muted animate-pulse font-black uppercase tracking-widest">Saving Changes...</span>
                      )}
                   </div>
                </div>
              </div>

              <div className="bg-bg-primary/30 p-4 border-t border-border-subtle flex items-center justify-between">
                 <div className="flex items-center gap-2 text-text-muted italic text-[10px]">
                    <Info className="w-3 h-3" /> All changes will apply to future sales immediately.
                 </div>
                 <div className="flex items-center gap-2">
                    {template.updated_at ? (
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-green-500/60 flex items-center gap-1">
                         <CheckCircle2 className="w-2.5 h-2.5" /> Updated {new Date(template.updated_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted">System Default</span>
                    )}
                 </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

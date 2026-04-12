'use client'

import { useState } from 'react'
import { Plus, Tag, Trash2, Loader2, X, Percent, DollarSign, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { showToast } from '@/lib/utils/toast'

interface PromoCode {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  uses_count: number
  min_order_amount: number
  expires_at: string | null
  is_active: boolean
}

export default function PromoCodeManager({ codes: initialCodes }: { codes: PromoCode[] }) {
  const router = useRouter()
  const [codes, setCodes] = useState<PromoCode[]>(initialCodes)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [codeToDelete, setCodeToDelete] = useState<PromoCode | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    max_uses: '',
    min_order_amount: '',
    expires_at: '',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discount_value: parseFloat(form.discount_value),
          max_uses: form.max_uses ? parseInt(form.max_uses) : null,
          min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : 0,
          expires_at: form.expires_at || null,
        })
      })
      const data = await res.json()
      if (!res.ok) { showToast.error(data.error); return }
      setCodes(prev => [data.promo, ...prev])
      setShowForm(false)
      setForm({ code: '', discount_type: 'percentage', discount_value: '', max_uses: '', min_order_amount: '', expires_at: '' })
      showToast.success('Promo code created!')
    } catch {
      showToast.error('Failed to create promo code')
    } finally {
      setLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!codeToDelete) return
    setIsDeleting(true)
    try {
      await fetch(`/api/promo?id=${codeToDelete.id}`, { method: 'DELETE' })
      setCodes(prev => prev.filter(c => c.id !== codeToDelete.id))
      showToast.success('Promo code deleted')
      setCodeToDelete(null)
    } catch {
      showToast.error('Failed to delete')
    } finally {
      setIsDeleting(false)
    }
  }

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setForm(p => ({ ...p, code }))
  }

  return (
    <div className="space-y-6">
      {/* Create button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 h-12 px-6 bg-accent-orange text-white rounded-xl font-bold uppercase tracking-widest hover:bg-[#ff6a1f] transition-all shadow-lg shadow-accent-orange/20"
        >
          <Plus className="w-5 h-5" /> Create Promo Code
        </button>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-bg-surface rounded-3xl border border-border-subtle p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-white text-lg">New Promo Code</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-text-muted hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="flex-1 bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-accent-orange uppercase"
                  placeholder="SALE20"
                  required
                />
                <button type="button" onClick={generateCode} className="px-4 h-12 bg-bg-primary border border-border-subtle rounded-xl text-xs font-bold text-text-muted hover:text-white uppercase tracking-widest transition-colors">
                  Generate
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Discount Type</label>
              <select
                value={form.discount_type}
                onChange={e => setForm(p => ({ ...p, discount_type: e.target.value as any }))}
                className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-orange"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">
                {form.discount_type === 'percentage' ? 'Percentage Off' : 'Amount Off ($)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={form.discount_type === 'percentage' ? '100' : undefined}
                  value={form.discount_value}
                  onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                  className="w-full bg-bg-primary border border-border-subtle rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:outline-none focus:border-accent-orange"
                  placeholder={form.discount_type === 'percentage' ? '20' : '5.00'}
                  required
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                  {form.discount_type === 'percentage' ? <Percent className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Max Uses (leave blank for unlimited)</label>
              <input
                type="number"
                min="1"
                value={form.max_uses}
                onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))}
                className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-orange"
                placeholder="100"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Min Order Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.min_order_amount}
                onChange={e => setForm(p => ({ ...p, min_order_amount: e.target.value }))}
                className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-orange"
                placeholder="0.00"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2 block">Expires At (optional)</label>
              <input
                type="datetime-local"
                value={form.expires_at}
                onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))}
                className="w-full bg-bg-primary border border-border-subtle rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent-orange"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-accent-orange text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#ff6a1f] disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Code
          </button>
        </form>
      )}

      {/* Codes list */}
      <div className="bg-bg-surface rounded-3xl border border-border-subtle overflow-hidden">
        <div className="p-5 border-b border-border-subtle">
          <p className="text-xs font-black uppercase tracking-widest text-text-muted">{codes.length} Active Codes</p>
        </div>

        {codes.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Tag className="w-10 h-10 text-text-muted opacity-30 mx-auto" />
            <p className="text-text-muted font-bold">No promo codes yet</p>
            <p className="text-sm text-text-muted">Create your first discount code to drive more sales.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {codes.map(code => {
              const isExpired = code.expires_at && new Date(code.expires_at) < new Date()
              const isMaxed = code.max_uses !== null && code.uses_count >= code.max_uses
              const isInactive = isExpired || isMaxed || !code.is_active

              return (
                <div key={code.id} className={`flex items-center gap-4 px-5 py-4 ${isInactive ? 'opacity-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-white tracking-widest">{code.code}</span>
                      {isInactive && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                          {isExpired ? 'Expired' : isMaxed ? 'Max uses reached' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {code.discount_type === 'percentage' ? `${code.discount_value}% off` : `$${code.discount_value} off`}
                      {code.min_order_amount > 0 && ` · min $${code.min_order_amount}`}
                      {code.max_uses !== null && ` · ${code.uses_count}/${code.max_uses} uses`}
                      {code.max_uses === null && ` · ${code.uses_count} uses`}
                      {code.expires_at && ` · expires ${new Date(code.expires_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => copyCode(code.code, code.id)}
                      className="p-2 text-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                      title="Copy code"
                    >
                      {copiedId === code.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setCodeToDelete(code)}
                      className="p-2 text-text-muted hover:text-red-500 rounded-lg hover:bg-red-500/5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!codeToDelete}
        onClose={() => setCodeToDelete(null)}
        title="Delete Promo Code"
        description={`Are you sure you want to delete the code "${codeToDelete?.code}"? This will deactivate the discount immediately.`}
        confirmLabel="Delete Code"
        onConfirm={confirmDelete}
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  )
}

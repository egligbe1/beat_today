import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, DollarSign, Loader2, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  beatId: string
  producerId: string
  beatTitle: string
  licenseType: string
  suggestedPrice?: number
}

export default function MakeOfferModal({ isOpen, onClose, beatId, producerId, beatTitle, licenseType, suggestedPrice }: Props) {
  const [amount, setAmount] = useState(suggestedPrice ? suggestedPrice.toString() : '')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/negotiations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beat_id: beatId,
          producer_id: producerId,
          license_type: licenseType,
          amount: Number(amount),
          message
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setSuccess(true)
      toast.success('Offer sent successfully!')
      
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 3000)

    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-bg-surface border border-white/10 rounded-3xl p-8"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-text-muted hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-accent-gold/10 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-accent-gold" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">
                Make an Offer
              </h2>
              <p className="text-text-muted text-sm mt-2">
                Negotiating {licenseType} license for &quot;{beatTitle}&quot;
              </p>
            </div>

            {success ? (
              <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                <h3 className="text-green-400 font-bold mb-2">Offer Sent!</h3>
                <p className="text-sm text-green-500/80">The producer will review your offer and get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-1.5">
                    Your Offer (USD)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-accent-gold transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4" /> Message (Optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-gold transition-colors resize-none h-24"
                    placeholder="Tell the producer why they should accept your offer..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !amount}
                  className="w-full h-12 bg-accent-gold hover:bg-accent-gold/90 text-black rounded-xl font-black uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Offer'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

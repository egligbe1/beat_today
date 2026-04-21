import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Download, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  isOpen: boolean
  onClose: () => void
  beatId: string
  producerId: string
  beatTitle: string
}

export default function EmailGateModal({ isOpen, onClose, beatId, producerId, beatTitle }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/downloads/free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beat_id: beatId, producer_id: producerId, email, name })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Something went wrong')

      setSuccess(true)
      toast.success('Download link sent to your email!')
      
      // Auto close after 3 seconds
      setTimeout(() => {
        onClose()
        setSuccess(false)
        setEmail('')
        setName('')
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
              <div className="w-16 h-16 rounded-full bg-accent-orange/10 flex items-center justify-center mx-auto mb-4">
                <Download className="w-8 h-8 text-accent-orange" />
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-widest">
                Unlock Free Download
              </h2>
              <p className="text-text-muted text-sm mt-2">
                Enter your email to download &quot;{beatTitle}&quot;. By downloading, you agree to receive updates from the producer.
              </p>
            </div>

            {success ? (
              <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                <h3 className="text-green-400 font-bold mb-2">Success!</h3>
                <p className="text-sm text-green-500/80">Check your inbox. We&apos;ve sent the download link to {email}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent-orange transition-colors"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase tracking-widest mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-accent-orange transition-colors"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-accent-orange hover:bg-accent-orange/90 text-white rounded-xl font-bold uppercase tracking-widest text-sm transition-colors flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get Download Link'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

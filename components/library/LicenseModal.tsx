'use client'

import { useState } from 'react'
import { FileText, Download, X } from 'lucide-react'

interface LicenseModalProps {
  licenseText: string
  orderItemId: string
  beatTitle: string
}

export default function LicenseModal({ licenseText, orderItemId, beatTitle }: LicenseModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadPdf = async () => {
    setIsDownloading(true)
    try {
      const response = await fetch(`/api/licenses/download?itemId=${orderItemId}`)
      if (!response.ok) throw new Error('Failed to generate PDF')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `License_${beatTitle.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PDF:', error)
      alert('Failed to download license PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-bold uppercase tracking-widest transition-all"
      >
        <FileText className="w-4 h-4 text-accent-orange" />
        View License Agreement
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-surface border border-white/10 w-full max-w-3xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/20">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-widest">License Agreement</h3>
                <p className="text-text-muted text-xs tracking-wider mt-1">For: {beatTitle}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-black/40 custom-scrollbar">
              <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-text-muted/90">
                {licenseText}
              </pre>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-4">
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 transition-colors border border-transparent"
              >
                Close
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-accent-orange hover:bg-accent-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-accent-orange/20"
              >
                {isDownloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  isLoading?: boolean
  variant?: 'danger' | 'primary'
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  isLoading,
  variant = 'primary'
}: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Card */}
      <div className="relative bg-bg-surface border border-border-subtle rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-300">
        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase tracking-tight text-white">{title}</h2>
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-white/5 transition-colors text-text-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {description && (
            <p className="text-text-muted text-sm leading-relaxed">
              {description}
            </p>
          )}

          {children}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 h-12 px-6 rounded-xl border border-border-subtle text-sm font-bold uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            {onConfirm && (
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={cn(
                  "flex-1 h-12 px-6 rounded-xl text-sm font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2",
                  variant === 'danger' 
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20" 
                    : "bg-white text-black hover:bg-white/90"
                )}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
                ) : confirmLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

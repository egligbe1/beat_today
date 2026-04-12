'use client'

import { useState } from 'react'
import { Check, Info, ShoppingCart, ShoppingBag } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useCartStore } from '@/lib/stores/cartStore'
import { useOwnedLicenses } from '@/lib/hooks/useOwnedLicenses'
import Link from 'next/link'

interface LicenseOption {
  id: 'mp3' | 'wav' | 'trackout' | 'exclusive'
  name: string
  price: number | null
  features: string[]
}

interface LicenseSelectorProps {
  beat: {
    id: string
    title: string
    cover_url: string
    is_exclusive_sold?: boolean
    users_profiles: {
      display_name: string
    }
  }
  prices: {
    mp3: number | null
    wav: number | null
    trackout: number | null
    exclusive: number | null
  }
}

export default function LicenseSelector({ beat, prices }: LicenseSelectorProps) {
  const [selected, setSelected] = useState<'mp3' | 'wav' | 'trackout' | 'exclusive'>('mp3')
  const { addItem, setIsOpen } = useCartStore()
  const { isOwned, loading } = useOwnedLicenses(beat.id)

  const options: LicenseOption[] = ([
    {
      id: 'mp3',
      name: 'MP3 Lease',
      price: prices.mp3,
      features: ['MP3 File', 'Used for 1 music video', 'Distribute up to 10,000 copies'],
    },
    {
      id: 'wav',
      name: 'WAV Lease',
      price: prices.wav,
      features: ['MP3 + WAV', 'Used for 2 music videos', 'Distribute up to 50,000 copies'],
    },
    {
      id: 'trackout',
      name: 'Trackout',
      price: prices.trackout,
      features: ['MP3, WAV + STEMS', 'Used for unlimited music videos', 'Distribute up to 500,000 copies'],
    },
    {
      id: 'exclusive',
      name: 'Exclusive',
      price: beat.is_exclusive_sold ? null : prices.exclusive, // null hides sold exclusives
      features: ['Full Ownership', 'Unlimited distributions', 'Beat removed from store'],
    },
  ] as const).filter(opt => opt.price !== null) as any

  const currentOwned = isOwned(selected)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3">
        {options.map((option) => {
          const owned = isOwned(option.id)
          return (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left group",
                selected === option.id 
                  ? "border-accent-orange bg-accent-orange/10 shadow-lg shadow-accent-orange/10" 
                  : "border-border-subtle bg-bg-surface hover:border-text-muted"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                  selected === option.id ? "border-accent-orange bg-accent-orange" : "border-border-subtle"
                )}>
                  {selected === option.id && <Check className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-text-primary uppercase tracking-tight">{option.name}</h4>
                    {owned && (
                      <span className="bg-accent-orange/20 text-accent-orange text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Owned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">{option.features[0]}</p>
                </div>
              </div>
              <div className="text-right">
                  <p className="font-bold text-lg text-text-primary">
                    {owned ? 'OWNED' : formatCurrency(option.price || 0)}
                  </p>
                  <div className="text-[10px] text-accent-orange hover:underline flex items-center gap-1 justify-end">
                      <Info className="w-3 h-3" /> View Terms
                  </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="bg-bg-elevated p-6 rounded-2xl border border-border-subtle">
        <h5 className="font-bold text-sm mb-4 uppercase tracking-widest text-text-muted">License Features</h5>
        <ul className="space-y-3">
          {options.find(o => o.id === selected)?.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text-primary">
              <Check className="w-4 h-4 text-accent-orange mt-0.5" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {!currentOwned ? (
        <button 
          onClick={() => {
            const selectedOption = options.find(o => o.id === selected)
            if (selectedOption && selectedOption.price !== null) {
              addItem({
                beat_id: beat.id,
                title: beat.title,
                producer_name: beat.users_profiles.display_name,
                cover_url: beat.cover_url,
                license_type: selectedOption.id as any,
                price: selectedOption.price,
              })
            }
          }}
          className="w-full h-14 bg-accent-orange text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-opacity-90 active:scale-[0.98] transition-all shadow-xl shadow-accent-orange/20"
        >
          <ShoppingBag className="w-5 h-5" />
          Add to Cart
        </button>
      ) : (
        <Link 
          href="/dashboard/purchases"
          className="w-full h-14 bg-[#60a5fa]/10 text-[#60a5fa] border border-blue-400/30 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-blue-400/20 active:scale-[0.98] transition-all"
        >
          <Check className="w-5 h-5" />
          View in Library
        </Link>
      )}
    </div>
  )
}


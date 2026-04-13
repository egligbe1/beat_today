'use client'

import { useState } from 'react'
import BeatCard from '@/components/beats/BeatCard'
import { Music, CassetteTape, Disc, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileTabsContainerProps {
  beats: any[]
  producer: any
  totalPlays: number
  totalReviews: number
}

export default function ProfileTabsContainer({ beats, producer, totalPlays, totalReviews }: ProfileTabsContainerProps) {
  const [activeTab, setActiveTab] = useState('Beats')

  const tabs = [
    { name: 'Beats', icon: Music, count: beats.length },
    { name: 'Albums', icon: Disc, count: 0 },
    { name: 'Drumkits', icon: CassetteTape, count: 0 },
    { name: 'Contact', icon: Mail }
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'Beats':
        return beats.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {beats.map((beat) => (
              <BeatCard key={beat.id} beat={beat} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-bg-surface rounded-3xl border-2 border-dashed border-border-subtle">
            <p className="text-text-muted">No beats published yet.</p>
          </div>
        )
      
      case 'Albums':
      case 'Drumkits':
        return (
          <div className="text-center py-20 bg-bg-surface rounded-3xl border-2 border-dashed border-border-subtle">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
               {activeTab === 'Albums' ? <Disc className="w-8 h-8 text-text-muted" /> : <CassetteTape className="w-8 h-8 text-text-muted" />}
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">{activeTab} Coming Soon</h3>
            <p className="text-text-muted text-sm max-w-xs mx-auto">
              {producer.display_name} hasn't uploaded any {activeTab.toLowerCase()} yet. Stay tuned!
            </p>
          </div>
        )

      case 'Contact':
        return (
          <div className="max-w-2xl mx-auto bg-bg-surface p-8 rounded-3xl border border-border-subtle">
             <h3 className="text-xl font-black uppercase tracking-tight mb-6">Send a Message</h3>
             <div className="space-y-4">
                <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Subject</label>
                   <input type="text" className="w-full h-12 bg-bg-primary border border-border-subtle rounded-xl px-4 text-sm focus:border-accent-orange transition-colors" placeholder="Inquiry about custom beats..." />
                </div>
                <div>
                   <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-2">Message</label>
                   <textarea rows={5} className="w-full bg-bg-primary border border-border-subtle rounded-xl p-4 text-sm focus:border-accent-orange transition-colors" placeholder="Hey, I'd love to work with you..." />
                </div>
                <button className="w-full h-12 bg-accent-orange text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-opacity-90 transition-all">Send Message</button>
             </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="lg:col-span-8 space-y-10">
      <div className="sticky top-16 lg:top-0 bg-bg-primary/80 backdrop-blur-xl z-20 border-b border-border-subtle -mx-4 px-4 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-8 sm:gap-10 h-16 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={cn(
                "whitespace-nowrap h-full border-b-2 transition-all flex items-center gap-2",
                activeTab === tab.name 
                  ? "text-accent-orange border-accent-orange" 
                  : "text-text-muted border-transparent hover:text-text-primary"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.name}
              {tab.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px]",
                  activeTab === tab.name ? "bg-accent-orange/10" : "bg-white/5"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-10 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black uppercase tracking-tight">
            {activeTab === 'Beats' ? 'Latest Releases' : activeTab}
          </h2>
          {activeTab === 'Beats' && (
            <div className="text-[10px] font-black uppercase tracking-widest text-text-muted">Sort by: Newest</div>
          )}
        </div>

        {renderContent()}

        {/* Statistics Overview (Shared across tabs or fixed at bottom) */}
        <div className="bg-bg-surface p-8 sm:p-12 rounded-[40px] border border-border-subtle grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold mb-2">Total Plays</p>
            <p className="text-3xl font-black">{totalPlays.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold mb-2">Beats Sold</p>
            <p className="text-3xl font-black">0</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold mb-2">Active Stems</p>
            <p className="text-3xl font-black">{beats.length}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold mb-2">Reviews</p>
            <p className="text-3xl font-black">{totalReviews}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

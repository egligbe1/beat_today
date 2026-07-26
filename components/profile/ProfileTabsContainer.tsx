'use client'

import { useState } from 'react'
import Image from 'next/image'
import BeatCard from '@/components/beats/BeatCard'
import { Music, CassetteTape, Disc, Mail, TrendingUp, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProfileTabsContainerProps {
  beats: any[]
  producer: any
  totalPlays: number
  totalReviews: number
  services?: any[]
}

export default function ProfileTabsContainer({ beats, producer, totalPlays, totalReviews, services = [] }: ProfileTabsContainerProps) {
  const [activeTab, setActiveTab] = useState('Beats')

  const tabs = [
    { name: 'Beats', icon: Music, count: beats.length },
    { name: 'Services', icon: CassetteTape, count: services.length },
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
      
      case 'Services':
        return services.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc) => (
              <div key={svc.id} className="bg-bg-surface border border-border-subtle rounded-3xl p-6 flex flex-col items-center text-center">
                 <div className="w-16 h-16 rounded-2xl bg-white/5 mb-4 overflow-hidden relative">
                    {svc.cover_url ? <Image src={svc.cover_url} fill sizes="64px" className="object-cover" alt="service cover" /> : <CassetteTape className="w-8 h-8 text-text-muted m-auto absolute inset-0" />}
                 </div>
                 <h3 className="text-white font-bold mb-2">{svc.title}</h3>
                 <p className="text-text-muted text-xs mb-4 line-clamp-2">{svc.description}</p>
                 <div className="mt-auto w-full">
                    <button className="w-full h-10 rounded-xl bg-accent-orange text-white font-bold text-xs uppercase tracking-widest hover:bg-accent-orange/90 transition-colors">
                      Book — ${svc.price}
                    </button>
                    <p className="text-[10px] text-text-muted mt-2 text-center uppercase tracking-widest">{svc.delivery_time_days} Days Delivery</p>
                 </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-bg-surface rounded-3xl border-2 border-dashed border-border-subtle">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
               <CassetteTape className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white mb-2">Services Coming Soon</h3>
            <p className="text-text-muted text-sm max-w-xs mx-auto">
              {producer.display_name} hasn&apos;t added any services yet.
            </p>
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
              {producer.display_name} hasn&apos;t uploaded any {activeTab.toLowerCase()} yet. Stay tuned!
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
    <div className="lg:col-span-8 space-y-12">
      {/* Sticky Premium Tab Bar */}
      <div className="sticky top-16 lg:top-0 bg-bg-primary/80 backdrop-blur-xl z-20 border-b border-border-subtle px-2 overflow-x-auto hide-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center justify-start md:justify-center gap-6 sm:gap-10 h-16 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em]">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={cn(
                "whitespace-nowrap h-full border-b-2 transition-all flex items-center gap-2 px-1",
                activeTab === tab.name 
                   ? "text-accent-orange border-accent-orange" 
                   : "text-text-muted border-transparent hover:text-text-primary"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.name}</span>
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

      <div className="space-y-12 pt-4">
        <div className="flex items-center justify-between border-l-4 border-accent-orange pl-4">
          <h2 className="text-3xl font-black uppercase tracking-tight italic">
            {activeTab === 'Beats' ? 'Latest Releases' : activeTab}
          </h2>
          {activeTab === 'Beats' && (
            <div className="text-[10px] font-black uppercase tracking-widest text-text-muted hidden sm:block">Sort by: Newest</div>
          )}
        </div>

        <div className="min-h-[400px]">
            {activeTab === 'Beats' ? (
              beats.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {beats.map((beat: any) => (
                    <BeatCard key={beat.id} beat={beat} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-bg-surface rounded-3xl border-2 border-dashed border-border-subtle">
                  <p className="text-text-muted italic">No beats published yet.</p>
                </div>
              )
            ) : renderContent()}
        </div>

        {/* Premium Performance Statistics */}
        <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-accent-orange/10 to-accent-gold/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-bg-surface p-6 sm:p-10 rounded-[2.5rem] border border-border-subtle overflow-hidden">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 text-center md:text-left divide-x-0 md:divide-x divide-border-subtle">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold flex items-center justify-center md:justify-start gap-2">
                        <TrendingUp className="w-3 h-3" /> Global Plays
                    </p>
                    <p className="text-4xl font-black tracking-tighter italic">{totalPlays.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1 md:pl-8">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold flex items-center justify-center md:justify-start gap-2">
                        <Disc className="w-3 h-3" /> Beats Sold
                    </p>
                    <p className="text-4xl font-black tracking-tighter italic">0</p>
                  </div>
                  <div className="space-y-1 md:pl-8">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold flex items-center justify-center md:justify-start gap-2">
                        <Music className="w-3 h-3" /> Master Stems
                    </p>
                    <p className="text-4xl font-black tracking-tighter italic">{beats.length}</p>
                  </div>
                  <div className="space-y-1 md:pl-8">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-accent-gold flex items-center justify-center md:justify-start gap-2">
                        <Star className="w-3 h-3" /> Reviews
                    </p>
                    <p className="text-4xl font-black tracking-tighter italic">{totalReviews}</p>
                  </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

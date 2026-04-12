import { ShieldCheck, Zap, Globe, Users } from 'lucide-react'

const stats = [
  { icon: ShieldCheck, label: 'Secure Licensing', value: '100%' },
  { icon: Zap, label: 'Instant Downloads', value: 'Fast' },
  { icon: Users, label: 'Active Producers', value: '15k+' },
  { icon: Globe, label: 'World Class Sounds', value: 'Global' },
]

export default function TrustRibbon() {
  return (
    <div className="w-full bg-white/[0.03] border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-3 group">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-[#FF5500]/10 transition-colors">
                <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-text-muted group-hover:text-[#FF5500] transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted leading-tight truncate">{stat.label}</p>
                <p className="text-sm font-black text-white">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

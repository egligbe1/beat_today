import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Music, Mic2 } from 'lucide-react'

export default function ValuePropSplit() {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
      {/* For Artists */}
      <div className="group relative overflow-hidden rounded-3xl bg-bg-surface border border-white/5 aspect-[3/2] sm:aspect-auto sm:h-[480px] shadow-2xl transition-all hover:border-[#FFB000]/30">
        <Image
          src="/cta-artist.png"
          alt="Artists"
          fill
          className="object-cover opacity-40 group-hover:scale-105 transition-transform duration-[2s]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        <div className="absolute inset-0 p-5 sm:p-8 md:p-10 flex flex-col justify-end gap-3 sm:gap-5">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-[#FFB000]/10 flex items-center justify-center border border-[#FFB000]/20">
            <Mic2 className="w-5 h-5 sm:w-7 sm:h-7 text-[#FFB000]" />
          </div>
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter leading-none text-white">
              For <br /><span className="text-[#FFB000]">Artists</span>
            </h2>
            <p className="text-text-muted text-sm sm:text-base font-medium max-w-xs">
              Secure premium licenses and jumpstart your career with high-quality beats.
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 h-10 sm:h-12 px-5 sm:px-7 bg-white text-black rounded-full font-black uppercase tracking-widest text-xs hover:bg-[#FFB000] hover:text-white transition-all"
            >
              Browse Beats <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* For Producers */}
      <div className="group relative overflow-hidden rounded-3xl bg-bg-surface border border-white/5 aspect-[3/2] sm:aspect-auto sm:h-[480px] shadow-2xl transition-all hover:border-[#FF5500]/30">
        <Image
          src="/cta-producer.png"
          alt="Producers"
          fill
          className="object-cover opacity-40 group-hover:scale-105 transition-transform duration-[2s]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        <div className="absolute inset-0 p-5 sm:p-8 md:p-10 flex flex-col justify-end gap-3 sm:gap-5">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-[#FF5500]/10 flex items-center justify-center border border-[#FF5500]/20">
            <Music className="w-5 h-5 sm:w-7 sm:h-7 text-[#FF5500]" />
          </div>
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter leading-none text-white">
              For <br /><span className="text-[#FF5500]">Producers</span>
            </h2>
            <p className="text-text-muted text-sm sm:text-base font-medium max-w-xs">
              Sell your beats to a global audience and keep 100% of your earnings.
            </p>
            <Link
              href="/signup?role=producer"
              className="inline-flex items-center gap-2 h-10 sm:h-12 px-5 sm:px-7 bg-white text-black rounded-full font-black uppercase tracking-widest text-xs hover:bg-[#FF5500] hover:text-white transition-all"
            >
              Start Selling <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

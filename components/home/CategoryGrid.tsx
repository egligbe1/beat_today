import Link from 'next/link'
import Image from 'next/image'

const categories = [
  { name: 'AFROBEATS', slug: 'Afrobeats', image: '/genre-trap.png' },
  { name: 'AMAPIANO', slug: 'Amapiano', image: '/genre-hiphop.png' },
  { name: 'HIGHLIFE', slug: 'Highlife', image: '/genre-rnb.png' },
  { name: 'AFRO-DRILL', slug: 'Afro-drill', image: '/genre-drill.png' },
]

export default function CategoryGrid() {
  return (
    <section className="space-y-5 sm:space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Browse by Genre</h2>
        <p className="text-text-muted text-sm mt-1">Explore the world&apos;s most popular sounds.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {categories.map((cat, i) => (
          <Link
            key={i}
            href={`/search?genre=${cat.slug}`}
            className="group relative aspect-[4/3] sm:aspect-[16/9] overflow-hidden rounded-2xl sm:rounded-3xl bg-bg-surface border border-white/5 hover:border-white/20 transition-all active:scale-[0.98] shadow-xl shadow-black/30"
          >
            <Image
              src={cat.image}
              alt={cat.name}
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-700 opacity-60 group-hover:opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5">
              <h3 className="text-sm sm:text-lg font-black text-white tracking-widest uppercase group-hover:text-[#FF5500] transition-colors">{cat.name}</h3>
              <div className="w-6 sm:w-10 h-0.5 sm:h-1 bg-[#FF5500] rounded-full mt-1 sm:mt-2 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

// Category entry points only — no invented ratings, review counts, or price
// claims. Real per-service stats can return once genuine data clears the
// display threshold.
const services = [
  { title: 'Home Deep Clean', category: 'Cleaning', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop' },
  { title: 'Boiler Repair', category: 'Plumbing', image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=300&fit=crop' },
  { title: 'Interior Painting', category: 'Painting', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=300&fit=crop' },
  { title: 'Garden Maintenance', category: 'Gardening', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop' },
  { title: 'Flat-Pack Assembly', category: 'Handyman', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop' },
  { title: 'Electrical Rewiring', category: 'Electrical', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop' },
]

export default function PopularServices() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-[#f7f8f7]">
      <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">Popular</p>
            <h2 className="text-[1.75rem] sm:text-[2rem] font-bold text-dark tracking-[-0.02em]">Popular services</h2>
          </div>
          <Link href="/book" className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-dark transition-colors">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((s) => (
            <Link key={s.title} href={`/book?query=${encodeURIComponent(s.title)}`} className="group bg-white rounded-xl overflow-hidden border border-border/60 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:border-border transition-all">
              <div className="relative h-44 overflow-hidden">
                <img src={s.image} alt={s.title} className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <span className="absolute top-3 left-3 bg-white/95 text-[11.5px] font-medium text-dark px-2.5 py-1 rounded-md">{s.category}</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-dark leading-snug">{s.title}</h3>
                  <ArrowUpRight size={16} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                </div>
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                  <span className="text-[13px] text-muted">Free quotes from vetted pros</span>
                  <span className="text-[12.5px] font-medium text-primary">Get quotes</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

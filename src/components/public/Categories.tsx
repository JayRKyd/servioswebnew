import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// No invented per-category job counts — real volume stats can return once
// genuine numbers clear the display threshold
const categories = [
  { name: 'Cleaning', desc: 'Deep cleans, end of tenancy', icon: '🧹' },
  { name: 'Plumbing', desc: 'Boilers, leaks, bathrooms', icon: '🔧' },
  { name: 'Electrical', desc: 'Rewiring, fuse boxes, lights', icon: '⚡' },
  { name: 'Painting & Decorating', desc: 'Interior, exterior, wallpaper', icon: '🎨' },
  { name: 'Gardening', desc: 'Lawns, hedges, landscaping', icon: '🌿' },
  { name: 'Removals', desc: 'House moves, man & van', icon: '📦' },
  { name: 'Handyman', desc: 'Shelving, flat-pack, odd jobs', icon: '🔨' },
  { name: 'Pest Control', desc: 'Rodents, insects, birds', icon: '🐛' },
]

export default function Categories() {
  return (
    <section id="categories" className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">Services</p>
            <h2 className="text-[1.75rem] sm:text-[2rem] font-bold text-dark tracking-[-0.02em]">What do you need done?</h2>
          </div>
          <a href="#" className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-dark transition-colors">
            All services <ArrowRight size={14} />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categories.map(({ name, desc, icon }) => (
            <Link key={name} href={`/book?query=${encodeURIComponent(name)}`} className="group flex items-start gap-4 p-4 rounded-xl border border-border/70 bg-white hover:border-primary/25 hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all text-left">
              <span className="text-2xl mt-0.5 shrink-0 grayscale-[0.2] group-hover:grayscale-0 transition-all">{icon}</span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-dark group-hover:text-primary transition-colors">{name}</p>
                <p className="text-[12.5px] text-muted mt-0.5 leading-snug">{desc}</p>
                <p className="text-[11.5px] font-medium text-primary/70 mt-1.5">Get free quotes →</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-6 text-center sm:hidden">
          <a href="#" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
            View all services <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  )
}

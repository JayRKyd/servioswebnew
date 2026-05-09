import { ArrowRight } from 'lucide-react'

const categories = [
  { name: 'Cleaning', desc: 'Deep cleans, end of tenancy', jobs: '12.4K jobs', icon: '🧹' },
  { name: 'Plumbing', desc: 'Boilers, leaks, bathrooms', jobs: '8.2K jobs', icon: '🔧' },
  { name: 'Electrical', desc: 'Rewiring, fuse boxes, lights', jobs: '6.7K jobs', icon: '⚡' },
  { name: 'Painting & Decorating', desc: 'Interior, exterior, wallpaper', jobs: '9.1K jobs', icon: '🎨' },
  { name: 'Gardening', desc: 'Lawns, hedges, landscaping', jobs: '7.3K jobs', icon: '🌿' },
  { name: 'Removals', desc: 'House moves, man & van', jobs: '5.8K jobs', icon: '📦' },
  { name: 'Handyman', desc: 'Shelving, flat-pack, odd jobs', jobs: '11.2K jobs', icon: '🔨' },
  { name: 'Pest Control', desc: 'Rodents, insects, birds', jobs: '2.1K jobs', icon: '🐛' },
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
          {categories.map(({ name, desc, jobs, icon }) => (
            <button key={name} className="group flex items-start gap-4 p-4 rounded-xl border border-border/70 bg-white hover:border-primary/25 hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all text-left">
              <span className="text-2xl mt-0.5 shrink-0 grayscale-[0.2] group-hover:grayscale-0 transition-all">{icon}</span>
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold text-dark group-hover:text-primary transition-colors">{name}</p>
                <p className="text-[12.5px] text-muted mt-0.5 leading-snug">{desc}</p>
                <p className="text-[11.5px] text-muted/70 mt-1.5">{jobs}</p>
              </div>
            </button>
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

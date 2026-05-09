import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Thornton',
    location: 'Manchester',
    text: "Found an amazing plumber within hours. Professional, fairly priced, and he fixed our boiler the same day. Can't fault the experience.",
    rating: 5,
    service: 'Plumbing',
    initials: 'ST',
  },
  {
    name: 'James Walsh',
    location: 'London',
    text: 'Used Servios for an end-of-tenancy clean. The team were thorough, arrived on time, and the landlord was impressed. Deposit returned in full.',
    rating: 5,
    service: 'Cleaning',
    initials: 'JW',
  },
  {
    name: 'Priya Kapoor',
    location: 'Birmingham',
    text: 'Got three quotes for a garden redesign within a day. The landscaper we chose completely transformed our back garden. Really pleased with the result.',
    rating: 5,
    service: 'Gardening',
    initials: 'PK',
  },
]

export default function Testimonials() {
  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-[#f7f8f7]">
      <div className="mx-auto w-[80%] max-w-[1800px] px-5 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[13px] font-medium text-primary uppercase tracking-wide mb-2">Reviews</p>
            <h2 className="text-[1.75rem] sm:text-[2rem] font-bold text-dark tracking-[-0.02em]">What our customers say</h2>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[13px] text-muted">
            <Star size={14} className="text-amber-400 fill-amber-400" />
            <span><strong className="text-dark font-semibold">4.8 out of 5</strong> from 12,400+ reviews</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 lg:gap-5">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-white rounded-xl p-5 sm:p-6 border border-border/60">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} size={14} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-[14.5px] text-dark leading-[1.65] mb-5">{t.text}</p>
              <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                <div className="w-9 h-9 rounded-full bg-[#f0f1f0] flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-muted">{t.initials}</span>
                </div>
                <div>
                  <p className="text-[13.5px] font-semibold text-dark">{t.name}</p>
                  <p className="text-[12px] text-muted">{t.location} &middot; {t.service}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

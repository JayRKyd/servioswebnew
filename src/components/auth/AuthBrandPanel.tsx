import { Star, Shield, Users } from 'lucide-react'

interface AuthBrandPanelProps {
  headline: React.ReactNode
  subline: string
  quote: string
  quoteAuthor: string
  quoteMeta: string
}

/** Right-hand brand panel for the auth pages (Payoneer-style split screen).
 *  Designed to look complete without photography — imagery can be layered in
 *  later by replacing the testimonial card area. */
export function AuthBrandPanel({ headline, subline, quote, quoteAuthor, quoteMeta }: AuthBrandPanelProps) {
  return (
    <div className="relative hidden lg:flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-[#0a4a43] p-12 xl:p-16 text-white">
      {/* Decorative shapes */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/[0.04]" />
      <div className="pointer-events-none absolute right-24 bottom-40 h-40 w-40 rounded-full bg-white/[0.05]" />

      {/* Headline */}
      <div className="relative max-w-[480px] pt-6">
        <h2 className="text-[2.5rem] xl:text-[3rem] font-bold leading-[1.1] tracking-[-0.03em]">
          {headline}
        </h2>
        <p className="mt-5 text-[16px] leading-relaxed text-white/70">{subline}</p>
      </div>

      {/* Testimonial */}
      <div className="relative max-w-[440px]">
        <div className="rounded-2xl bg-white/[0.08] p-6 ring-1 ring-white/15 backdrop-blur-sm">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={15} className="fill-amber-400 stroke-amber-400" />
            ))}
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-white/90">&ldquo;{quote}&rdquo;</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
              {quoteAuthor.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold">{quoteAuthor}</p>
              <p className="text-xs text-white/60">{quoteMeta}</p>
            </div>
          </div>
        </div>

        {/* Trust stats */}
        <div className="mt-8 flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <Star size={16} className="shrink-0 fill-amber-400 stroke-amber-400" />
            <div>
              <p className="text-sm font-bold leading-none">4.8/5</p>
              <p className="mt-1 text-[11px] text-white/60">12K+ reviews</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div className="flex items-center gap-2.5">
            <Users size={16} className="shrink-0 text-white/80" />
            <div>
              <p className="text-sm font-bold leading-none">50K+</p>
              <p className="mt-1 text-[11px] text-white/60">verified pros</p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/15" />
          <div className="flex items-center gap-2.5">
            <Shield size={16} className="shrink-0 text-white/80" />
            <div>
              <p className="text-sm font-bold leading-none">90-day</p>
              <p className="mt-1 text-[11px] text-white/60">workmanship guarantee</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

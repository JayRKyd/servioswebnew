import { Shield, BadgeCheck, Lock } from 'lucide-react'

interface AuthBrandPanelProps {
  headline: React.ReactNode
  subline: string
}

/** Right-hand brand panel for the auth pages (Payoneer-style split screen).
 *  Deliberately quiet: no invented stats or testimonials — only claims that
 *  are true from day one. Real numbers can be added once they clear the
 *  display threshold. */
export function AuthBrandPanel({ headline, subline }: AuthBrandPanelProps) {
  const points = [
    { icon: Shield, text: '90-day workmanship guarantee on every completed job' },
    { icon: BadgeCheck, text: 'Every professional is identity-checked and document-verified' },
    { icon: Lock, text: 'Payments held securely and only released when the job is done' },
  ]

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

      {/* Value points — true from day one */}
      <div className="relative max-w-[440px] space-y-4">
        {points.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-3.5 rounded-2xl bg-white/[0.08] p-4.5 px-5 py-4 ring-1 ring-white/15 backdrop-blur-sm">
            <Icon size={18} className="mt-0.5 shrink-0 text-white/90" />
            <p className="text-[14.5px] leading-relaxed text-white/90">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

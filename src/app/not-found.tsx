import Link from 'next/link'
import { ServiosMark } from '@/components/brand/Logo'

/** Branded 404 — the stock black Next.js error page read as unfinished
 *  (Round 3 review, design item 32). */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafbfa] px-6 text-center">
      <Link href="/" className="flex items-center gap-2">
        <ServiosMark size={34} />
        <span className="text-[20px] font-semibold text-[#171717] tracking-[-0.03em]">servios</span>
      </Link>
      <h1 className="mt-10 text-[3.5rem] font-bold leading-none text-dark tracking-[-0.03em]">404</h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
        That page doesn&apos;t exist — it may have moved, or the link is out of date.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
          Go to homepage
        </Link>
        <Link href="/search" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-dark hover:bg-white transition-colors">
          Browse providers
        </Link>
      </div>
    </div>
  )
}

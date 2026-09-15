import Link from 'next/link'
import { ServiosMark } from '@/components/brand/Logo'

/** Shared shell for the legal pages — drafts prepared for Servios Group
 *  Ltd's legal review before launch; keep structure, swap wording freely. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafbfa]">
      <div className="mx-auto max-w-3xl px-5 py-14">
        <Link href="/" className="flex items-center gap-2">
          <ServiosMark size={28} />
          <span className="text-[17px] font-semibold text-[#171717] tracking-[-0.03em]">servios</span>
        </Link>

        <div className="legal-prose mt-10">
          {children}
        </div>

        <div className="mt-14 border-t border-border pt-6 text-[13px] text-muted">
          <p>Servios Group Ltd · Registered in England &amp; Wales</p>
          <p className="mt-1">
            Questions? <a href="mailto:support@servios.co.uk" className="text-primary hover:underline">support@servios.co.uk</a>
            {' · '}
            <Link href="/terms" className="text-primary hover:underline">Terms</Link>
            {' · '}
            <Link href="/privacy" className="text-primary hover:underline">Privacy</Link>
            {' · '}
            <Link href="/cookies" className="text-primary hover:underline">Cookies</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

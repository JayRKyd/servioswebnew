import type { Metadata } from 'next'
import Link from 'next/link'
import { ServiosMark } from '@/components/brand/Logo'

export const metadata: Metadata = { title: 'Privacy Policy' }

// Placeholder route so the signup links resolve — the client supplies the
// final legal text before launch. Swap the body copy only; keep the shell.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#fafbfa]">
      <div className="mx-auto max-w-2xl px-5 py-14">
        <Link href="/" className="flex items-center gap-2">
          <ServiosMark size={28} />
          <span className="text-[17px] font-semibold text-[#171717] tracking-[-0.03em]">servios</span>
        </Link>
        <h1 className="mt-10 text-3xl font-bold text-dark tracking-[-0.02em]">Privacy Policy</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          Our full Privacy Policy is being finalised and will be published here
          before launch. Servios is operated by Servios Group Ltd.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Questions in the meantime? Contact us at{' '}
          <a href="mailto:support@servios.co.uk" className="text-primary hover:underline">support@servios.co.uk</a>.
        </p>
      </div>
    </div>
  )
}

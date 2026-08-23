import Link from 'next/link'
import { AuthBrandPanel } from './AuthBrandPanel'
import { ServiosMark } from '@/components/brand/Logo'

/** Split-screen shell shared by the secondary auth pages (verify email,
 *  forgot/reset password). Form column left, brand panel right — same
 *  structure as the login and signup pages. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left: content column */}
      <div className="flex w-full flex-col lg:w-[46%] lg:min-w-[520px]">
        <div className="h-[72px] flex items-center px-5 sm:px-10 lg:px-14 shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <ServiosMark size={30} />
            <span className="text-[19px] font-semibold text-[#171717] tracking-[-0.03em]">servios</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 sm:px-10 lg:px-14 pb-20">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>

      {/* Right: brand panel */}
      <AuthBrandPanel
        headline={<>Every job done,<br />by someone you trust.</>}
        subline="Tell us what you need, get matched with vetted local pros, and pay securely — your money is only released when the job is done."
        quote="Found a brilliant plumber within the hour. He turned up on time, fixed the leak, and the payment was all handled in the app. Couldn't be easier."
        quoteAuthor="Sarah Mitchell"
        quoteMeta="Homeowner, North London"
      />
    </div>
  )
}

import Link from 'next/link'
import { Mail } from 'lucide-react'

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-[#fafbfa] flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-[440px] text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Mail size={32} className="text-primary" />
          </div>
        </div>

        <h1 className="text-[1.75rem] font-bold text-dark tracking-[-0.02em] mb-3">
          Check your email
        </h1>
        <p className="text-[15px] text-muted leading-relaxed mb-8">
          We sent a confirmation link to your email address. Click it to activate your account and get started.
        </p>

        <div className="bg-white rounded-2xl border border-border/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6 text-left space-y-3 mb-8">
          <p className="text-[13.5px] text-muted">
            <span className="font-medium text-dark">Didn&apos;t get it?</span> Check your spam folder or make sure you entered the right email address.
          </p>
          <p className="text-[13.5px] text-muted">
            The link expires in <span className="font-medium text-dark">24 hours</span>.
          </p>
        </div>

        <Link
          href="/login"
          className="text-[13.5px] text-primary hover:text-primary-dark font-medium"
        >
          Back to log in
        </Link>
      </div>
    </div>
  )
}

'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MailCheck, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { AuthShell } from '@/components/auth/AuthShell'

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  )
}

function VerifyEmailContent() {
  const email = useSearchParams().get('email')
  const [resent, setResent] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleResend() {
    if (!email) return
    setResending(true)
    setError(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (error) { setError(error.message); return }
    setResent(true)
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08]">
        <MailCheck size={26} className="text-primary" />
      </div>

      <h1 className="mt-6 text-[1.9rem] font-bold text-dark tracking-[-0.02em]">Check your email</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        We sent a confirmation link to{' '}
        {email ? <span className="font-semibold text-dark">{email}</span> : 'your email address'}.
        Click the link to activate your account — it takes you straight to your dashboard.
      </p>

      <div className="mt-6 rounded-xl bg-[#fafbfa] border border-border px-4 py-3.5">
        <p className="text-[13px] text-muted leading-relaxed">
          Didn&apos;t receive it? Check your spam folder, or resend the link below.
          The link expires after 24 hours.
        </p>
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 space-y-3">
        {email && (
          resent ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-3.5 text-[14px] font-medium text-green-800">
              <CheckCircle2 size={16} />
              Confirmation email resent
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="w-full rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-white hover:bg-primary-dark transition-all disabled:opacity-60"
            >
              {resending ? 'Resending…' : 'Resend confirmation email'}
            </button>
          )
        )}

        <Link
          href="/login"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-[14px] font-medium text-dark hover:bg-gray-50 transition-all"
        >
          <ArrowLeft size={15} />
          Back to log in
        </Link>
      </div>
    </div>
  )
}

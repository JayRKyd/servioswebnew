'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, ArrowRight, MailCheck } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { AuthShell } from '@/components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
      return
    }

    setSent(true)
    setIsLoading(false)
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08]">
            <MailCheck size={26} className="text-primary" />
          </div>
          <h1 className="mt-6 text-[1.9rem] font-bold text-dark tracking-[-0.02em]">Check your email</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            We sent a password reset link to <span className="font-semibold text-dark">{email}</span>.
            Click the link to choose a new password.
          </p>
          <div className="mt-6 rounded-xl bg-[#fafbfa] border border-border px-4 py-3.5">
            <p className="text-[13px] text-muted leading-relaxed">
              Didn&apos;t receive it? Check your spam folder — the link expires after 24 hours.
            </p>
          </div>
          <Link
            href="/login"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-[14px] font-medium text-dark hover:bg-gray-50 transition-all"
          >
            <ArrowLeft size={15} />
            Back to log in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div>
        <h1 className="text-[1.9rem] font-bold text-dark tracking-[-0.02em]">Forgot password?</h1>
        <p className="mt-2 text-[15px] text-muted">
          Enter your email and we&apos;ll send you a link to reset it.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="text-[12.5px] font-medium text-dark mb-1.5 block">Email address</label>
            <div className="relative">
              <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#fafbfa] border border-border rounded-xl pl-10 pr-4 py-3 text-[14.5px] text-dark placeholder:text-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all disabled:opacity-60"
          >
            {isLoading ? 'Sending…' : 'Send reset link'}
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-muted">
          Remembered it?{' '}
          <Link href="/login" className="text-primary hover:text-primary-dark font-medium">Back to log in</Link>
        </p>
      </div>
    </AuthShell>
  )
}

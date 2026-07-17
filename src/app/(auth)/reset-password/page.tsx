'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight, TimerOff } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { AuthShell } from '@/components/auth/AuthShell'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session)
      setChecking(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }

    setSaving(true)
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setSaving(false); return }

    setDone(true)
    const meta = data.user?.user_metadata ?? {}
    const role = (meta.active_role ?? meta.role) as string | undefined
    const dest = role === 'provider' ? '/provider'
      : role === 'landlord' ? '/landlord'
      : role === 'tenant' ? '/tenant'
      : role === 'admin' ? '/admin'
      : '/dashboard'
    setTimeout(() => { router.push(dest); router.refresh() }, 1500)
  }

  return (
    <AuthShell>
      {checking ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !hasSession ? (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <TimerOff size={26} className="text-amber-600" />
          </div>
          <h1 className="mt-6 text-[1.9rem] font-bold text-dark tracking-[-0.02em]">Link expired</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            This password reset link is invalid or has expired. Request a new one and try again.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-white hover:bg-primary-dark transition-all"
          >
            Request a new link
            <ArrowRight size={16} />
          </Link>
        </div>
      ) : done ? (
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50">
            <CheckCircle2 size={26} className="text-green-600" />
          </div>
          <h1 className="mt-6 text-[1.9rem] font-bold text-dark tracking-[-0.02em]">Password updated</h1>
          <p className="mt-3 text-[15px] text-muted">You&apos;re signed in — taking you to your dashboard…</p>
        </div>
      ) : (
        <div>
          <h1 className="text-[1.9rem] font-bold text-dark tracking-[-0.02em]">Set a new password</h1>
          <p className="mt-2 text-[15px] text-muted">Choose a new password for your account.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="password" className="text-[12.5px] font-medium text-dark mb-1.5 block">New password</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-border rounded-xl pl-10 pr-11 py-3 text-[14.5px] text-dark placeholder:text-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm" className="text-[12.5px] font-medium text-dark mb-1.5 block">Confirm password</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-[#fafbfa] border border-border rounded-xl pl-10 pr-4 py-3 text-[14.5px] text-dark placeholder:text-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all disabled:opacity-60"
            >
              {saving ? 'Updating…' : 'Update password'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}
    </AuthShell>
  )
}

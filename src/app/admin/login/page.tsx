'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { isAdminUser } from '@/lib/permissions'
import { ServiosMark } from '@/components/brand/Logo'

export default function AdminLoginPage() {
  return <Suspense fallback={null}><AdminLoginForm /></Suspense>
}

/** Staff sign-in. Same Supabase accounts as everyone else, but only an
 *  account carrying the admin role gets through — anyone else is signed
 *  straight back out with a plain explanation. */
function AdminLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const requested = params.get('redirectTo') ?? '/admin'
  const redirectTo = requested.startsWith('/admin') && !requested.startsWith('//') ? requested : '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(
    params.get('denied') ? 'You’re signed in, but this account doesn’t have admin access. Sign in below with a staff account.' : null,
  )
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setError(signInError.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : signInError.message)
      setBusy(false)
      return
    }
    if (!isAdminUser(data.user)) {
      await supabase.auth.signOut()
      setError('This account doesn’t have admin access. Ask an existing admin to grant it from Users → Make admin, then sign in again.')
      setBusy(false)
      return
    }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f2e2b] px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center justify-center gap-2">
          <ServiosMark size={32} />
          <span className="text-[20px] font-semibold tracking-[-0.03em] text-white">servios</span>
          <span className="ml-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/80">Admin</span>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ShieldCheck size={22} /></div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Staff sign in</h1>
              <p className="mt-0.5 text-sm text-gray-500">For the Servios team. Customers and providers sign in at the <Link href="/login" className="text-primary underline underline-offset-2">normal login</Link>.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" placeholder="you@servios.co.uk" />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">Password</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60">
              {busy ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-xs text-gray-500">
            <Link href="/forgot-password" className="hover:text-gray-900 hover:underline">Forgotten your password?</Link>
            <span>Access is granted by an existing admin.</span>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/50">Servios Group Ltd · Company No. 16840842 · Staff access is logged.</p>
      </div>
    </div>
  )
}

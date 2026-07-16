'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { supabase } from '@/lib/auth'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>
}
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedDestination = searchParams.get('redirectTo') ?? '/dashboard'
  const redirectTo = requestedDestination.startsWith('/') && !requestedDestination.startsWith('//')
    ? requestedDestination
    : '/dashboard'
  const signupHref = `/signup?redirectTo=${encodeURIComponent(redirectTo)}`

  // Messages from the auth callback (email confirmation / recovery links)
  const authNotice = searchParams.get('auth_notice') === 'confirmed_please_login'
    ? 'Your email is confirmed — log in to get started.'
    : null
  const authError = searchParams.get('auth_error') === 'link_invalid'
    ? 'That link is invalid or has expired. Log in, or request a new link.'
    : null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setIsLoading(false); return }
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#fafbfa] flex flex-col">
      <div className="h-[64px] flex items-center px-5 lg:px-8 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 bg-primary rounded-lg" />
            <svg className="relative" width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M10 20.5c0-2.5 3-4.5 6-4.5s6 2 6 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="12" r="3.5" stroke="white" strokeWidth="2" />
            </svg>
          </div>
          <span className="text-[18px] font-semibold text-dark tracking-[-0.03em]">Servios</span>
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center pt-8 sm:pt-16 pb-16 px-5">
        <div className="w-full max-w-[440px]">
          <div className="text-center mb-8">
            <h1 className="text-[1.75rem] sm:text-[2rem] font-bold text-dark tracking-[-0.02em]">Welcome back</h1>
            <p className="text-[15px] text-muted mt-2">Log in to manage your bookings and messages.</p>
          </div>

          {authNotice && (
            <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              ✓ {authNotice}
            </div>
          )}
          {authError && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {authError}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-border/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6 sm:p-8">
            <div className="flex bg-[#f4f5f4] rounded-xl p-1 mb-6">
              <button className="flex-1 text-[13.5px] font-medium py-2.5 rounded-lg transition-all bg-white text-dark shadow-sm">
                Log In
              </button>
              <Link href={signupHref} className="flex-1 text-[13.5px] font-medium py-2.5 rounded-lg transition-all text-muted hover:text-dark text-center">
                Sign Up
              </Link>
            </div>

            <div className="space-y-2.5">
              <button className="w-full flex items-center justify-center gap-3 bg-white border border-border rounded-xl px-4 py-3 text-[14px] font-medium text-dark hover:bg-gray-50 hover:border-gray-300 transition-all">
                <GoogleIcon />
                Continue with Google
              </button>
              <button className="w-full flex items-center justify-center gap-3 bg-dark text-white rounded-xl px-4 py-3 text-[14px] font-medium hover:bg-dark/90 transition-all">
                <AppleIcon />
                Continue with Apple
              </button>
            </div>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[12px] text-muted font-medium uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="text-[12.5px] font-medium text-dark mb-1.5 block">Email address</label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-[#fafbfa] border border-border rounded-xl pl-10 pr-4 py-3 text-[14.5px] text-dark placeholder:text-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12.5px] font-medium text-dark">Password</label>
                  <Link href="/forgot-password" className="text-[12px] text-primary hover:text-primary-dark font-medium transition-colors">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-[#fafbfa] border border-border rounded-xl pl-10 pr-11 py-3 text-[14.5px] text-dark placeholder:text-gray-400 outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold text-[15px] py-3.5 rounded-xl transition-all mt-1 disabled:opacity-60"
              >
                {isLoading ? 'Logging in…' : 'Log In'}
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          <p className="text-center text-[13px] text-muted mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:text-primary-dark font-medium">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'

export default function ConfirmedPage() {
  return <Suspense fallback={null}><Confirmed /></Suspense>
}

function Confirmed() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const requested = searchParams.get('next') ?? '/dashboard'
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard'

  const [seconds, setSeconds] = useState(3)

  useEffect(() => {
    if (seconds <= 0) {
      router.replace(next)
      return
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds, next, router])

  return (
    <AuthShell>
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.08]">
          <CheckCircle2 size={26} className="text-primary" />
        </div>
        <h1 className="mt-6 text-[1.9rem] font-bold text-dark tracking-[-0.02em]">Email confirmed</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Your account is verified and you&apos;re signed in.
          Taking you to your account{seconds > 0 ? ` in ${seconds}…` : '…'}
        </p>
        <button
          onClick={() => router.replace(next)}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-dark py-3.5 text-[15px] font-semibold text-white transition-all"
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </AuthShell>
  )
}

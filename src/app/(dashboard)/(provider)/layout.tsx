'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { OnboardingContext } from '@/contexts/OnboardingContext'
import type { OnboardingCtx } from '@/contexts/OnboardingContext'

// Module-level cache — onboarding status doesn't change mid-session
let _onboardingCache: { userId: string; ctx: OnboardingCtx } | null = null

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const cachedCtx = user && _onboardingCache?.userId === user.id ? _onboardingCache.ctx : null

  const [ctx, setCtx] = useState<OnboardingCtx>(cachedCtx ?? { complete: true, step: 'complete' })
  const [checked, setChecked] = useState(!!cachedCtx)

  const isSetupRoute = pathname?.startsWith('/provider/setup')

  useEffect(() => {
    if (authLoading) return
    if (!user) { setChecked(true); return }

    // Cache hit
    if (_onboardingCache?.userId === user.id) {
      const cached = _onboardingCache.ctx
      setCtx(cached)
      setChecked(true)
      if (!cached.complete && !isSetupRoute) {
        router.replace(`/provider/setup/${cached.step}`)
      }
      return
    }

    supabase
      .from('provider_profiles')
      .select('onboarding_complete, onboarding_step')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data: profile }) => {
        const complete = profile?.onboarding_complete === true || profile?.onboarding_step === 'complete'
        const step = profile?.onboarding_step ?? 'trade'
        const newCtx: OnboardingCtx = { complete, step }
        _onboardingCache = { userId: user.id, ctx: newCtx }
        setCtx(newCtx)
        setChecked(true)
        if (!complete && !isSetupRoute) {
          router.replace(`/provider/setup/${step}`)
        }
      })
      .catch(() => setChecked(true))
  }, [user?.id, authLoading])

  if (!checked) return (
    <div className="flex h-full items-center justify-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )

  return (
    <OnboardingContext.Provider value={ctx}>
      {children}
    </OnboardingContext.Provider>
  )
}

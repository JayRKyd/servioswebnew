'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuthContext } from '@/components/providers/AuthProvider'
import { OnboardingContext } from '@/contexts/OnboardingContext'
import type { OnboardingCtx } from '@/contexts/OnboardingContext'

// Module-level cache — onboarding status only changes when a setup step
// completes, and those pages call invalidateOnboardingCache().
let _cache: { userId: string; ctx: OnboardingCtx } | null = null

export function invalidateOnboardingCache() {
  _cache = null
}

const COMPLETE: OnboardingCtx = { complete: true, step: 'complete' }

/** Provides provider-onboarding status to the whole dashboard shell (the
 *  Sidebar locks nav off it) — it must wrap the Sidebar, not just the
 *  provider pages. Non-provider roles get the "complete" default. */
export function OnboardingProvider({ isProvider, children }: { isProvider: boolean; children: React.ReactNode }) {
  const { user } = useAuthContext()

  const cached = user && _cache?.userId === user.id ? _cache.ctx : null
  const [ctx, setCtx] = useState<OnboardingCtx>(cached ?? COMPLETE)
  const [checked, setChecked] = useState(!isProvider || !!cached)

  useEffect(() => {
    if (!isProvider) { setCtx(COMPLETE); setChecked(true); return }
    if (!user) return

    if (_cache?.userId === user.id) {
      setCtx(_cache.ctx)
      setChecked(true)
      return
    }

    supabase
      .from('provider_profiles')
      .select('onboarding_complete, onboarding_step')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data: profile }) => {
        const complete = profile?.onboarding_complete === true || profile?.onboarding_step === 'complete'
        const newCtx: OnboardingCtx = { complete, step: profile?.onboarding_step ?? 'trade' }
        _cache = { userId: user.id, ctx: newCtx }
        setCtx(newCtx)
        setChecked(true)
      })
      .catch(() => setChecked(true))
  }, [user?.id, isProvider])

  if (!checked) return (
    <div className="flex h-screen items-center justify-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )

  return (
    <OnboardingContext.Provider value={ctx}>
      {children}
    </OnboardingContext.Provider>
  )
}

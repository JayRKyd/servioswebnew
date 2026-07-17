'use client'
import { useContext, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { OnboardingContext } from '@/contexts/OnboardingContext'

// Onboarding status is fetched once in the dashboard shell (OnboardingProvider,
// which also feeds the Sidebar lock). This layout just enforces the funnel:
// providers who haven't finished setup are sent to their current step.
export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { complete, step } = useContext(OnboardingContext)
  const pathname = usePathname()
  const router = useRouter()

  const inSetup = pathname.startsWith('/provider/setup')
  const mustRedirect = !complete && !inSetup

  useEffect(() => {
    if (mustRedirect) router.replace(`/provider/setup/${step}`)
  }, [mustRedirect, step, router])

  if (mustRedirect) return (
    <div className="flex h-full items-center justify-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )

  return <>{children}</>
}

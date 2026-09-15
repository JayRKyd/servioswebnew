'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Cookie } from 'lucide-react'

const CONSENT_KEY = 'servios_cookie_consent'

/** Read the stored choice — future analytics/marketing scripts must check
 *  this and only load when it returns 'all'. */
export function getCookieConsent(): 'all' | 'essential' | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    return JSON.parse(raw).choice ?? null
  } catch {
    return null
  }
}

/** One-time cookie banner. Servios currently sets essential cookies only, so
 *  this is disclosure + a recorded preference that future non-essential
 *  scripts (analytics etc.) must respect. Dismissing persists per browser. */
export function CookieNotice() {
  const [visible, setVisible] = useState(false)

  // Render nothing on the server and only show after mount when no choice
  // is stored — avoids hydration mismatch and repeat prompts
  useEffect(() => {
    if (!getCookieConsent()) setVisible(true)
  }, [])

  function choose(choice: 'all' | 'essential') {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: new Date().toISOString() }))
    } catch { /* private-mode storage failures just mean it shows again */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm sm:p-0">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.08]">
            <Cookie size={15} className="text-primary" />
          </div>
          <p className="text-[13px] leading-relaxed text-gray-600">
            Servios uses essential cookies to keep you signed in. We&rsquo;d also like
            your permission for optional cookies that help us improve the service.{' '}
            <Link href="/cookies" className="text-primary underline underline-offset-2">Cookie Notice</Link>
          </p>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => choose('all')}
            className="flex-1 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Accept all
          </button>
          <button
            onClick={() => choose('essential')}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Essential only
          </button>
        </div>
      </div>
    </div>
  )
}

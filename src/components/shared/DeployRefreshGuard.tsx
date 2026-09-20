'use client'
import { useEffect, useRef } from 'react'

/** Reloads stale tabs after a new deployment.
 *
 *  Long-lived tabs keep executing the JS bundle they first loaded; after a
 *  redeploy their chunk URLs 404 and handlers misbehave in ways that look
 *  like freezes or dead buttons. This polls the deploy id (on an interval
 *  and whenever the tab regains focus) and hard-reloads the moment the tab
 *  is stale — preferring the instant the user returns to the tab, before
 *  they interact with a dead UI. */
export function DeployRefreshGuard() {
  const initial = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check(reloadNow: boolean) {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const { version } = await res.json()
        if (!version || cancelled) return
        if (initial.current === null) { initial.current = version; return }
        if (version !== initial.current && reloadNow) {
          window.location.reload()
        }
      } catch { /* offline — try again next cycle */ }
    }

    check(false) // record the tab's deploy id
    const interval = setInterval(() => check(true), 5 * 60 * 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') check(true) }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return null
}

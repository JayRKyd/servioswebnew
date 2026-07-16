'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, X } from 'lucide-react'

/** Green confirmation banner shown once after email verification
 *  (the auth callback redirects to the role dashboard with ?verified=1). */
export function VerifiedBanner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (searchParams.get('verified') === '1') {
      setVisible(true)
      // Strip the param so refreshes / shared links don't re-show it
      const params = new URLSearchParams(searchParams.toString())
      params.delete('verified')
      router.replace(params.size > 0 ? `${pathname}?${params}` : pathname, { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
      <CheckCircle2 size={18} className="shrink-0 text-green-600" />
      <p className="flex-1 text-sm font-medium text-green-800">
        Email confirmed — welcome to Servios! Your account is ready to use.
      </p>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-1 text-green-600 hover:bg-green-100 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  )
}

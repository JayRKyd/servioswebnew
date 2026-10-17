'use client'
import { useEffect, useRef, useState } from 'react'
import { loadStripe, type Stripe, type StripeElements, type StripePaymentElement } from '@stripe/stripe-js'
import { Lock } from 'lucide-react'

const publishableKey = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').trim()
const stripePromise = publishableKey && publishableKey !== 'pk_test_placeholder' ? loadStripe(publishableKey) : null

interface Props {
  clientSecret: string
  amountLabel: string
  /** Called with the PaymentIntent status once Stripe accepts the card
   *  (`requires_capture` for our manual-capture flow). */
  onAuthorised: (intentId: string, status: string) => Promise<void> | void
  onCancel: () => void
}

/** Stripe PaymentElement mounted directly (no react-stripe-js dependency).
 *  Card is authorised only — capture happens when the customer confirms the
 *  job, which is the escrow promise the booking page makes. */
export function StripePaymentForm({ clientSecret, amountLabel, onAuthorised, onCancel }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const elementRef = useRef<StripePaymentElement | null>(null)
  const [stripe, setStripe] = useState<Stripe | null>(null)
  const [elements, setElements] = useState<StripeElements | null>(null)
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    ;(async () => {
      if (!stripePromise) { setError('The payment form isn’t available right now — please contact support.'); return }
      const s = await stripePromise
      if (!s || disposed || !mountRef.current) { if (!s) setError('Stripe failed to load. Check your connection and try again.'); return }
      const els = s.elements({
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: { colorPrimary: '#115e56', borderRadius: '12px', fontFamily: 'inherit', fontSizeBase: '14px' },
        },
      })
      const el = els.create('payment', { layout: 'tabs' })
      el.mount(mountRef.current)
      el.on('ready', () => { if (!disposed) setReady(true) })
      elementRef.current = el
      setStripe(s)
      setElements(els)
    })()
    return () => {
      disposed = true
      elementRef.current?.destroy()
      elementRef.current = null
    }
  }, [clientSecret])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || submitting) return
    setSubmitting(true)
    setError(null)
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    })
    if (confirmError) {
      setError(confirmError.message ?? 'Your card was not accepted. Please try another card.')
      setSubmitting(false)
      return
    }
    if (paymentIntent) {
      await onAuthorised(paymentIntent.id, paymentIntent.status)
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-primary/20 bg-white p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Pay {amountLabel}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          Your card is authorised now and only charged when you confirm the job is complete.
        </p>
      </div>
      <div ref={mountRef} className="min-h-[140px]" />
      {!ready && !error && <p className="text-xs text-gray-400">Loading secure payment form…</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={!ready || submitting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
          <Lock size={14} /> {submitting ? 'Authorising…' : `Authorise ${amountLabel}`}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting}
          className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          Not now
        </button>
      </div>
      <p className="text-[11px] text-gray-400">Payments are processed by Stripe. Servios never sees your card number.</p>
    </form>
  )
}

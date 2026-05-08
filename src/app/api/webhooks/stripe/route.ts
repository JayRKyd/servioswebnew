import { NextRequest } from 'next/server'
import { app } from '@/server/app'

// Forward raw Stripe webhook body to the Hono handler in-process.
// Must be raw text so stripe.webhooks.constructEvent() can verify the signature.
export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''

  return app.fetch(
    new Request('http://localhost/api/v1/payments/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
      body,
    })
  )
}

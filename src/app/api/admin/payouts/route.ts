import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { loadPayouts, releasePayments } from '@/server/lib/payouts'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async () => NextResponse.json(await loadPayouts()))

/** Release one or more payments to a provider: record a manual bank payout
 *  (reference required) or push the Stripe transfer for a connected account. */
export const POST = withAdmin(async ({ user, db, req }) => {
  const body = await req.json().catch(() => ({}))
  const paymentIds: string[] = Array.isArray(body?.paymentIds) ? body.paymentIds.map(String) : []
  const method = body?.method === 'stripe' ? 'stripe' : 'manual'
  const reference = typeof body?.reference === 'string' ? body.reference.trim() : ''
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : ''
  if (!paymentIds.length) throw new AdminInputError('Choose at least one payment')
  if (method === 'manual' && !reference) throw new AdminInputError('Enter the bank transfer reference so the payout can be traced')
  if (body?.overrideHold && !notes) throw new AdminInputError('A note is required when releasing a payment that has an open dispute')

  const results = await releasePayments({ paymentIds, actorId: user.id, method, reference: reference || null, notes: notes || null, overrideHold: !!body?.overrideHold })
  await logAdminAction(db, user.id, {
    action: method === 'manual' ? 'payout.record_manual' : 'payout.stripe_release',
    targetTable: 'payments', targetId: paymentIds.join(','),
    after: { results, reference: reference || null, overrideHold: !!body?.overrideHold },
    reason: notes || reference || null,
  })
  return NextResponse.json({ ok: true, results })
})

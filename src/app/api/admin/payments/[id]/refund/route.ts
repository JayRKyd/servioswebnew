import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { refundPayment, paymentById } from '@/server/lib/payments'

/** Refund (full or partial, in pence) or release a held authorisation.
 *  Reason required — it goes on the Stripe refund and the audit log. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const amountPence = body?.amountPence != null ? Number(body.amountPence) : undefined
  if (!reason) throw new AdminInputError('A reason is required')
  if (amountPence != null && !(Number.isFinite(amountPence) && amountPence > 0)) throw new AdminInputError('Amount must be a positive number of pence')

  const before = await paymentById(id)
  if (!before) throw new AdminInputError('Payment not found')

  let result
  try {
    result = await refundPayment(id, { amountPence, reason, actorUserId: user.id })
  } catch (e: any) {
    throw new AdminInputError(e?.message ?? 'Refund failed')
  }

  await logAdminAction(db, user.id, {
    action: result.kind === 'cancelled' ? 'payment.release_hold' : 'payment.refund',
    targetTable: 'payments',
    targetId: id,
    before: { payment_status: before.payment_status, refund_amount: before.refund_amount },
    after: { payment_status: result.payment.payment_status, refund_amount: result.payment.refund_amount, refund_id: result.refundId, amount: result.amount, commission: result.commission, provider_share: result.providerShare, provider_transfer: result.share },
    reason,
  })

  return NextResponse.json({ ok: true, ...result })
})

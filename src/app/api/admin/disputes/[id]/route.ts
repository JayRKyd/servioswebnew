import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { loadDisputeView } from '@/server/lib/dispute-views'
import { OPEN_STATUSES, previewResolution, addDisputeMessage } from '@/server/lib/disputes'
import { paymentById, latestPaymentForBooking } from '@/server/lib/payments'

export const dynamic = 'force-dynamic'

export const GET = withAdmin<{ params: Promise<{ id: string }> }>(async ({ ctx }) => {
  const { id } = await ctx.params
  const view = await loadDisputeView(id, 'admin')
  if (!view) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
  return NextResponse.json(view)
})

const WORKFLOW = ['open', 'under_review', 'awaiting_customer', 'awaiting_provider'] as const
const STATUS_NOTE: Record<string, string> = {
  under_review: 'Servios support is reviewing this case.',
  awaiting_customer: 'Servios support is waiting for more information from the customer.',
  awaiting_provider: 'Servios support is waiting for the provider to respond.',
}

/** PATCH — workflow status / priority, or a live preview of a resolution. */
export const PATCH = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const { data: dispute } = await db.from('disputes').select('*').eq('id', id).maybeSingle()
  if (!dispute) throw new AdminInputError('Dispute not found')

  if (body?.preview) {
    const payment = dispute.payment_id ? await paymentById(dispute.payment_id) : await latestPaymentForBooking(dispute.booking_id)
    const { data: b } = await db.from('bookings').select('commission_rate').eq('id', dispute.booking_id).maybeSingle()
    const raw = Number(b?.commission_rate ?? 0.12)
    return NextResponse.json({ preview: previewResolution(payment, raw >= 1 ? raw / 100 : raw, body.preview.outcome, body.preview.amountPence) })
  }

  if (!(OPEN_STATUSES as readonly string[]).includes(dispute.status)) throw new AdminInputError('This dispute is closed')
  const patch: Record<string, unknown> = {}
  if (body?.status) {
    if (!(WORKFLOW as readonly string[]).includes(body.status)) throw new AdminInputError('Unknown status')
    patch.status = body.status
    if (!dispute.assigned_to) { patch.assigned_to = user.id; patch.assigned_at = new Date().toISOString() }
  }
  if (body?.priority) {
    if (!['low', 'normal', 'high', 'urgent'].includes(body.priority)) throw new AdminInputError('Unknown priority')
    patch.priority = body.priority
  }
  if (!Object.keys(patch).length) throw new AdminInputError('Nothing to change')

  const { data: updated, error } = await db.from('disputes').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  if (patch.status && patch.status !== dispute.status && STATUS_NOTE[patch.status as string]) {
    await addDisputeMessage({ disputeId: id, senderId: null, role: 'system', body: STATUS_NOTE[patch.status as string], visibleTo: 'all' })
  }
  await logAdminAction(db, user.id, {
    action: 'dispute.update', targetTable: 'disputes', targetId: id,
    before: { status: dispute.status, priority: dispute.priority }, after: patch,
  })
  return NextResponse.json({ ok: true, dispute: updated })
})

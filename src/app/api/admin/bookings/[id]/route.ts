import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { bookingDetail, actOnBooking, AdminOpsError, type BookingAction } from '@/server/lib/admin-ops'

export const dynamic = 'force-dynamic'

export const GET = withAdmin<{ params: Promise<{ id: string }> }>(async ({ ctx }) => {
  const { id } = await ctx.params
  const detail = await bookingDetail(id)
  if (!detail) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  return NextResponse.json(detail)
})

/** cancel (optionally refunding), set_status (unstick), resend_summary. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const action = body?.action as BookingAction
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!['cancel', 'set_status', 'resend_summary'].includes(action)) throw new AdminInputError('Unknown action')
  if (!reason) throw new AdminInputError('A reason is required — it goes on the booking and in the audit log')
  const { data: before } = await db.from('bookings').select('status, payment_status, customer_confirmed_at').eq('id', id).maybeSingle()
  try {
    const result = await actOnBooking(id, action, { actorId: user.id, reason, status: body?.status, refund: !!body?.refund })
    await logAdminAction(db, user.id, { action: `booking.${action}`, targetTable: 'bookings', targetId: id, before, after: { ...result, status: body?.status, refund: !!body?.refund }, reason })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof AdminOpsError) throw new AdminInputError(e.message)
    throw e
  }
})

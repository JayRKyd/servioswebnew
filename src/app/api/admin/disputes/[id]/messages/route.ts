import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { addDisputeMessage } from '@/server/lib/disputes'

/** Admin message to both sides, one side only, or an internal note. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const visibleTo = body?.visibleTo
  if (!['all', 'customer', 'provider', 'admin'].includes(visibleTo)) throw new AdminInputError('Choose who sees the message')
  const { data: dispute } = await db.from('disputes').select('id').eq('id', id).maybeSingle()
  if (!dispute) throw new AdminInputError('Dispute not found')

  const message = await addDisputeMessage({ disputeId: id, senderId: user.id, role: 'admin', body: String(body?.body ?? ''), visibleTo })
  await logAdminAction(db, user.id, { action: 'dispute.message', targetTable: 'disputes', targetId: id, after: { visibleTo, messageId: message.id } })
  return NextResponse.json({ ok: true, messageId: message.id })
})

import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { resolveDispute, type Resolution } from '@/server/lib/disputes'

/** Decide a dispute: full refund, partial refund (pence), release to the
 *  provider, or close with no money movement. Notes are shown to both sides. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const outcome = body?.outcome as Resolution
  if (!['full_refund', 'partial_refund', 'release_to_provider', 'no_action'].includes(outcome)) throw new AdminInputError('Choose an outcome')

  const { data: before } = await db.from('disputes').select('status, held_amount').eq('id', id).maybeSingle()
  const result = await resolveDispute({
    disputeId: id,
    actorId: user.id,
    outcome,
    amountPence: body?.amountPence != null ? Number(body.amountPence) : null,
    notes: String(body?.notes ?? ''),
  })
  await logAdminAction(db, user.id, {
    action: `dispute.resolve.${outcome}`, targetTable: 'disputes', targetId: id,
    before, after: { status: 'resolved', refunded: result.refunded },
    reason: String(body?.notes ?? ''),
  })
  return NextResponse.json({ ok: true, ...result })
})

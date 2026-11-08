import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { moderateReview, AdminOpsError } from '@/server/lib/admin-ops'

/** hide (reversible, drops out of public view and the rating), unhide,
 *  clear_flag, or delete (permanent). */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const action = body?.action
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!['hide', 'unhide', 'delete', 'clear_flag'].includes(action)) throw new AdminInputError('Unknown action')
  if ((action === 'hide' || action === 'delete') && !reason) throw new AdminInputError('A reason is required')
  const { data: before } = await db.from('reviews').select('rating, review_text, reviewer_id, reviewee_id, is_flagged, hidden_at').eq('id', id).maybeSingle()
  try {
    const result = await moderateReview(id, action, user.id, reason)
    await logAdminAction(db, user.id, { action: `review.${action}`, targetTable: 'reviews', targetId: id, before, after: result, reason: reason || null })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof AdminOpsError) throw new AdminInputError(e.message)
    throw e
  }
})

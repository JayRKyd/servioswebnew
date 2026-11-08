import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { userDetail, actOnUser, AdminOpsError, type UserAction } from '@/server/lib/admin-ops'

export const dynamic = 'force-dynamic'

export const GET = withAdmin<{ params: Promise<{ id: string }> }>(async ({ ctx }) => {
  const { id } = await ctx.params
  const detail = await userDetail(id)
  if (!detail) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json(detail)
})

/** suspend (auth ban + hidden from search), reinstate, close (anonymise),
 *  reset_password, note. Admin role changes live at ./admin-role. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const action = body?.action as UserAction
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!['suspend', 'reinstate', 'close', 'reset_password', 'note'].includes(action)) throw new AdminInputError('Unknown action')
  if (!reason && action !== 'reset_password') throw new AdminInputError('A reason is required')
  const { data: before } = await db.from('users').select('status, email').eq('id', id).maybeSingle()
  try {
    const result = await actOnUser(id, action, { actorId: user.id, reason })
    await logAdminAction(db, user.id, { action: `user.${action}`, targetTable: 'users', targetId: id, before, after: result, reason: reason || null })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof AdminOpsError) throw new AdminInputError(e.message)
    throw e
  }
})

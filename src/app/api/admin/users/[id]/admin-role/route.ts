import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'

/** Grant or revoke the admin role. Writes both `public.users.roles` (what
 *  the server routes check) and `auth.users.app_metadata.roles` (what the
 *  middleware and RLS check) so the two can't drift. The user has to sign
 *  in again for a new JWT to carry the change. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const grant = body?.grant === true
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  if (!grant && id === user.id) throw new AdminInputError('You cannot remove your own admin access')
  if (!grant && !reason) throw new AdminInputError('A reason is required when revoking admin access')

  const { data: row, error } = await db.from('users').select('id, email, roles, active_role').eq('id', id).maybeSingle()
  if (error) throw error
  if (!row) throw new AdminInputError('User not found')

  const roles: string[] = Array.isArray(row.roles) ? row.roles : []
  const nextRoles = grant
    ? Array.from(new Set([...roles, 'admin']))
    : roles.filter(r => r !== 'admin')
  const nextActive = !grant && row.active_role === 'admin' ? (nextRoles[0] ?? 'customer') : row.active_role

  const { error: tableError } = await db.from('users')
    .update({ roles: nextRoles, active_role: nextActive })
    .eq('id', id)
  if (tableError) throw tableError

  const { data: authUser, error: authReadError } = await db.auth.admin.getUserById(id)
  if (authReadError) throw authReadError
  const appMeta = (authUser.user.app_metadata ?? {}) as Record<string, unknown>
  const appRoles = Array.isArray(appMeta.roles) ? (appMeta.roles as string[]) : []
  const nextAppRoles = grant
    ? Array.from(new Set([...appRoles, 'admin']))
    : appRoles.filter(r => r !== 'admin')

  const { error: metaError } = await db.auth.admin.updateUserById(id, {
    app_metadata: { ...appMeta, roles: nextAppRoles },
    ...(nextActive !== row.active_role ? { user_metadata: { active_role: nextActive } } : {}),
  })
  if (metaError) throw metaError

  await logAdminAction(db, user.id, {
    action: grant ? 'user.grant_admin' : 'user.revoke_admin',
    targetTable: 'users',
    targetId: id,
    before: { roles, active_role: row.active_role },
    after: { roles: nextRoles, active_role: nextActive },
    reason: reason || null,
  })

  return NextResponse.json({ ok: true, email: row.email, roles: nextRoles })
})

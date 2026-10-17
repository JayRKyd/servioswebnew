import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/auth-server'
import { isAdminUser } from '@/lib/permissions'

/** Service-role client for admin route handlers. Bypasses RLS, so every
 *  caller must go through `requireAdmin` first. */
export function adminDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export class AdminAuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message)
  }
}

/** Thrown by handlers for bad input — rendered as a 400 with the message. */
export class AdminInputError extends Error {}

/** Resolves the signed-in user from cookies and checks admin membership in
 *  `app_metadata` (service-role writable only). Throws `AdminAuthError`;
 *  wrap handlers with `withAdmin` to turn that into a JSON response. */
export async function requireAdmin(): Promise<{ user: User; db: SupabaseClient }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new AdminAuthError(401, 'Not signed in')
  if (!isAdminUser(user)) throw new AdminAuthError(403, 'Admin access required')
  return { user, db: adminDb() }
}

export interface AdminActionLog {
  action: string
  targetTable?: string
  targetId?: string | null
  before?: unknown
  after?: unknown
  reason?: string | null
}

/** Every admin write records who did what, to which row, and the before/after
 *  state. Failures here never block the action — they surface in logs. */
export async function logAdminAction(db: SupabaseClient, actorId: string, entry: AdminActionLog): Promise<void> {
  const { error } = await db.from('admin_actions').insert({
    actor_id: actorId,
    action: entry.action,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    reason: entry.reason ?? null,
  })
  if (error) console.error('admin_actions insert failed:', error.message)
}

type AdminHandler<Ctx> = (args: { user: User; db: SupabaseClient; req: Request; ctx: Ctx }) => Promise<Response>

/** Route-handler wrapper: auth + uniform error JSON. Handlers throw
 *  `Error` for 400-class problems; anything else is a 500 with a generic body. */
export function withAdmin<Ctx = unknown>(handler: AdminHandler<Ctx>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const { user, db } = await requireAdmin()
      return await handler({ user, db, req, ctx })
    } catch (err) {
      if (err instanceof AdminAuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      if (err instanceof AdminInputError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      console.error('admin route failed:', err)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }
  }
}

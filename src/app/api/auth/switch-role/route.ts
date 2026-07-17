import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/auth-server'

const VALID_ROLES = ['customer', 'provider', 'landlord', 'tenant', 'admin']

// Service role: role changes write both public.users and the auth metadata
// (which the middleware and UI read), and the users table is locked against
// client updates.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user: sessionUser } } = await supabase.auth.getUser()

  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { role } = await req.json()
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data: userRow } = await admin
    .from('users')
    .select('roles')
    .eq('id', sessionUser.id)
    .single()

  if (!userRow?.roles?.includes(role)) {
    return NextResponse.json({ error: 'You do not have this role' }, { status: 403 })
  }

  const { error: tableError } = await admin
    .from('users')
    .update({ active_role: role })
    .eq('id', sessionUser.id)

  if (tableError) {
    return NextResponse.json({ error: tableError.message }, { status: 400 })
  }

  // Metadata is what the middleware and client read — keep it in lockstep
  const { error: metaError } = await admin.auth.admin.updateUserById(sessionUser.id, {
    user_metadata: { active_role: role },
  })

  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, active_role: role })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/auth-server'

// Self-service roles only — admin can never be self-assigned
const ADDABLE_ROLES = ['customer', 'provider', 'landlord', 'tenant']

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
  if (!ADDABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const { data: userRow } = await admin
    .from('users')
    .select('roles')
    .eq('id', sessionUser.id)
    .single()

  if (!userRow) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const roles: string[] = userRow.roles ?? []
  if (roles.includes(role)) {
    return NextResponse.json({ ok: true, roles }) // idempotent
  }

  const updatedRoles = [...roles, role]

  // 1. Users table
  const { error: tableError } = await admin
    .from('users')
    .update({ roles: updatedRoles })
    .eq('id', sessionUser.id)
  if (tableError) {
    return NextResponse.json({ error: tableError.message }, { status: 400 })
  }

  // 2. Auth metadata (what middleware + UI read)
  const { error: metaError } = await admin.auth.admin.updateUserById(sessionUser.id, {
    user_metadata: { roles: updatedRoles },
  })
  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 400 })
  }

  // 3. The role's profile row, so its dashboard works immediately
  const id = sessionUser.id
  const meta = sessionUser.user_metadata ?? {}
  const names = { first_name: meta.first_name ?? '', last_name: meta.last_name ?? '' }
  if (role === 'customer') {
    await admin.from('customer_profiles').upsert({ user_id: id, ...names }, { onConflict: 'user_id', ignoreDuplicates: true })
  } else if (role === 'provider') {
    await admin.from('provider_profiles').upsert(
      { user_id: id, business_name: '', ...names, onboarding_complete: false, onboarding_step: 'trade', verification_status: 'unverified' },
      { onConflict: 'user_id', ignoreDuplicates: true }
    )
  } else if (role === 'landlord') {
    await admin.from('landlord_profiles').upsert({ user_id: id, ...names }, { onConflict: 'user_id', ignoreDuplicates: true })
  } else if (role === 'tenant') {
    await admin.from('tenant_profiles').upsert({ user_id: id, ...names }, { onConflict: 'user_id', ignoreDuplicates: true })
  }

  return NextResponse.json({ ok: true, roles: updatedRoles }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/auth-server'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { role } = await req.json()

  const { data: user } = await supabase
    .from('users')
    .select('roles')
    .eq('id', session.user.id)
    .single()

  if (!user?.roles?.includes(role)) {
    return NextResponse.json({ error: 'You do not have this role' }, { status: 400 })
  }

  const { data: updatedUser, error } = await supabase
    .from('users')
    .update({ active_role: role })
    .eq('id', session.user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ user: updatedUser })
}

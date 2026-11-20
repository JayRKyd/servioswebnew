import { NextResponse } from 'next/server'
import { withUser } from '@/server/lib/route-user'
import { supabase } from '@/server/db/client'
import { payoutTermsFor } from '@/server/lib/payments'

export const dynamic = 'force-dynamic'

/** Which bank clearing delay applies to the signed-in provider, and why. */
export const GET = withUser(async ({ user }) => {
  const { data: pp } = await supabase.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle()
  if (!pp) return NextResponse.json({ error: 'No provider profile' }, { status: 404 })
  const terms = await payoutTermsFor(pp.id)
  if (!terms) return NextResponse.json({ error: 'No provider profile' }, { status: 404 })
  // The admin's private reason for an override stays with the team
  const { overrideReason: _private, override: _o, ...visible } = terms
  return NextResponse.json(visible)
})

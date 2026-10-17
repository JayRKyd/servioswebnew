import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { loadProviderQueue } from '@/server/lib/verification'

type Action = 'verify' | 'revoke' | 'reject' | 'reopen'

/** Manual verification decisions on a provider profile (`id` = profile id).
 *  Normal verification happens automatically when ID + insurance are
 *  approved; these are the exceptions and every one needs a reason. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const action = body?.action as Action
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  if (!['verify', 'revoke', 'reject', 'reopen'].includes(action)) throw new AdminInputError('Unknown action')
  if (action !== 'reopen' && !reason) throw new AdminInputError('A reason is required')

  const { data: profile, error } = await db
    .from('provider_profiles')
    .select('id, user_id, verification_status, verification_override, verification_notes, identity_verified, insurance_verified')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!profile) throw new AdminInputError('Provider not found')

  const now = new Date().toISOString()
  const hasRequiredDocs = !!profile.identity_verified && !!profile.insurance_verified
  let update: Record<string, unknown>
  switch (action) {
    case 'verify':
      update = {
        verification_status: 'verified',
        // Only an override when the documents alone wouldn't have done it
        verification_override: !hasRequiredDocs,
        verification_notes: reason,
        verified_at: now,
      }
      break
    case 'revoke':
      if (profile.verification_status !== 'verified') throw new AdminInputError('Provider is not verified')
      update = { verification_status: 'pending', verification_override: false, verification_notes: reason }
      break
    case 'reject':
      update = { verification_status: 'rejected', verification_override: false, verification_notes: reason }
      break
    case 'reopen':
      if (profile.verification_status !== 'rejected') throw new AdminInputError('Provider is not rejected')
      update = { verification_status: 'pending', verification_notes: reason || null }
      break
  }

  const { error: updateError } = await db.from('provider_profiles').update(update).eq('id', id)
  if (updateError) throw updateError

  await logAdminAction(db, user.id, {
    action: `provider.${action}`,
    targetTable: 'provider_profiles',
    targetId: id,
    before: { verification_status: profile.verification_status, verification_override: profile.verification_override },
    after: { verification_status: update.verification_status, verification_override: update.verification_override ?? profile.verification_override },
    reason: reason || null,
  })

  const [provider] = await loadProviderQueue(db, { profileIds: [id], scope: 'all' })
  return NextResponse.json({ ok: true, provider: provider ?? null })
})

import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { payoutTermsFor, refreshProviderPayoutDelay } from '@/server/lib/payments'
import { UK_MIN_PAYOUT_DELAY_DAYS } from '@/server/lib/settings'

/** Set or clear a provider's own clearing delay (`id` = profile id).
 *  `days: null` goes back to the automatic new-provider / standard rule. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const clearing = body?.days === null || body?.days === ''
  const days = clearing ? null : Number(body?.days)
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''

  if (days !== null && (!Number.isInteger(days) || days < UK_MIN_PAYOUT_DELAY_DAYS || days > 31)) {
    throw new AdminInputError(`Enter a whole number of days between ${UK_MIN_PAYOUT_DELAY_DAYS} and 31 (Stripe’s UK minimum is ${UK_MIN_PAYOUT_DELAY_DAYS})`)
  }
  if (days !== null && !reason) throw new AdminInputError('A reason is required')

  const before = await payoutTermsFor(id)
  if (!before) throw new AdminInputError('Provider not found')

  const { error } = await db.from('provider_profiles')
    .update({ payout_delay_override: days, payout_delay_override_reason: days === null ? null : reason })
    .eq('id', id)
  if (error) throw error

  // Applies it to the Stripe payout schedule and the profile's working value
  let stripeWarning: string | null = null
  try { await refreshProviderPayoutDelay(id) } catch (e) {
    console.error('payout delay refresh failed:', e)
    stripeWarning = 'Saved, but Stripe did not accept the new schedule yet — it will be retried on the provider’s next payment.'
  }
  const terms = await payoutTermsFor(id)

  await logAdminAction(db, user.id, {
    action: days === null ? 'provider.payout_delay_reset' : 'provider.payout_delay_override',
    targetTable: 'provider_profiles',
    targetId: id,
    before: { days: before.days, override: before.override },
    after: { days: terms?.days ?? null, override: days },
    reason: reason || null,
  })
  return NextResponse.json({ ok: true, terms, warning: stripeWarning })
})

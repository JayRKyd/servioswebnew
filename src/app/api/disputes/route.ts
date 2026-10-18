import { NextResponse } from 'next/server'
import { withUser } from '@/server/lib/route-user'
import { openDispute, disputeEligibility, type DisputeType, type DesiredOutcome } from '@/server/lib/disputes'

export const dynamic = 'force-dynamic'

/** GET ?bookingId= — can the signed-in customer report a problem? */
export const GET = withUser(async ({ user, req }) => {
  const bookingId = new URL(req.url).searchParams.get('bookingId')
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })
  return NextResponse.json(await disputeEligibility(bookingId, user.id))
})

/** POST — customer reports a problem. Holds the provider's share at once. */
export const POST = withUser(async ({ user, req }) => {
  const body = await req.json().catch(() => ({}))
  const dispute = await openDispute({
    bookingId: String(body?.bookingId ?? ''),
    userId: user.id,
    type: body?.type as DisputeType,
    description: String(body?.description ?? ''),
    desiredOutcome: body?.desiredOutcome as DesiredOutcome,
    desiredAmountPence: body?.desiredAmountPence != null ? Number(body.desiredAmountPence) : null,
    evidencePaths: Array.isArray(body?.evidencePaths) ? body.evidencePaths.map(String) : [],
  })
  return NextResponse.json({ ok: true, disputeId: dispute.id, number: dispute.dispute_number })
})

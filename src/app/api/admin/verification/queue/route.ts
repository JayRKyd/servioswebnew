import { NextResponse } from 'next/server'
import { withAdmin } from '@/server/lib/admin'
import { loadProviderQueue } from '@/server/lib/verification'

export const dynamic = 'force-dynamic'

/** Providers awaiting verification with every document they've uploaded and
 *  a 10-minute signed URL for each file. `?scope=all` lists every provider. */
export const GET = withAdmin(async ({ db, req }) => {
  const url = new URL(req.url)
  const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'queue'
  const only = url.searchParams.get('provider')

  // Approved documents past their expiry date lapse here (no pg_cron on this
  // project) — the trigger then recomputes the provider's verification
  const { error: sweepError } = await db.rpc('expire_provider_documents')
  if (sweepError) console.error('expire_provider_documents failed:', sweepError.message)

  const providers = await loadProviderQueue(db, {
    scope: only ? 'all' : scope,
    ...(only ? { profileIds: [only] } : {}),
  })
  return NextResponse.json({ providers })
})

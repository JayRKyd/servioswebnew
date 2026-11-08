import { NextResponse } from 'next/server'
import { withAdmin } from '@/server/lib/admin'
import { listReviews } from '@/server/lib/admin-ops'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async ({ req }) => {
  const f = new URL(req.url).searchParams.get('filter')
  const filter = f === 'flagged' || f === 'hidden' ? f : 'all'
  return NextResponse.json({ reviews: await listReviews(filter) })
})

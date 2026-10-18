import { NextResponse } from 'next/server'
import { withAdmin } from '@/server/lib/admin'
import { listDisputesForAdmin } from '@/server/lib/dispute-views'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async ({ req }) => {
  const s = new URL(req.url).searchParams.get('status')
  const status = s === 'resolved' || s === 'all' ? s : 'open'
  return NextResponse.json({ disputes: await listDisputesForAdmin(status) })
})

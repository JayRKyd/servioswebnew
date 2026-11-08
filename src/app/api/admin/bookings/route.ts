import { NextResponse } from 'next/server'
import { withAdmin } from '@/server/lib/admin'
import { listBookings } from '@/server/lib/admin-ops'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async ({ req }) => {
  const p = new URL(req.url).searchParams
  return NextResponse.json({ bookings: await listBookings({ status: p.get('status'), payment: p.get('payment'), q: p.get('q') }) })
})

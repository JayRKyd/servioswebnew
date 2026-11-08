import { NextResponse } from 'next/server'
import { withAdmin } from '@/server/lib/admin'
import { searchUsers } from '@/server/lib/admin-ops'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async ({ req }) => {
  const p = new URL(req.url).searchParams
  return NextResponse.json({ users: await searchUsers({ q: p.get('q'), role: p.get('role'), status: p.get('status') }) })
})

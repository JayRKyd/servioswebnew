import { NextResponse } from 'next/server'
import { withAdmin, AdminInputError } from '@/server/lib/admin'
import { detectCleanup, runCleanup, type CleanupKind } from '@/server/lib/cleanup'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async () => NextResponse.json({ items: await detectCleanup() }))

export const POST = withAdmin(async ({ user, req }) => {
  const body = await req.json().catch(() => ({}))
  const items = Array.isArray(body?.items) ? body.items.filter((i: any) => i?.kind && i?.id).map((i: any) => ({ kind: i.kind as CleanupKind, id: String(i.id) })) : []
  if (!items.length) throw new AdminInputError('Nothing selected')
  if (body?.confirm !== 'DELETE') throw new AdminInputError('Type DELETE to confirm')
  return NextResponse.json({ results: await runCleanup(items, user.id) })
})

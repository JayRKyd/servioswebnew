import { NextResponse } from 'next/server'
import { withUser } from '@/server/lib/route-user'
import { supabase } from '@/server/db/client'
import { addDisputeMessage, OPEN_STATUSES } from '@/server/lib/disputes'

/** A party adds to the dispute thread (and evidence via attachments). */
export const POST = withUser<{ params: Promise<{ id: string }> }>(async ({ user, req, ctx }) => {
  const { id } = await ctx.params
  const { data: dispute } = await supabase.from('disputes').select('filed_by, filed_against, status').eq('id', id).maybeSingle()
  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const role = dispute.filed_by === user.id ? 'customer' : dispute.filed_against === user.id ? 'provider' : null
  if (!role) return NextResponse.json({ error: 'Not your dispute' }, { status: 403 })
  if (!(OPEN_STATUSES as readonly string[]).includes(dispute.status)) {
    return NextResponse.json({ error: 'This case is closed — contact support if something has changed' }, { status: 409 })
  }
  const body = await req.json().catch(() => ({}))
  const message = await addDisputeMessage({
    disputeId: id,
    senderId: user.id,
    role,
    body: String(body?.body ?? ''),
    attachments: Array.isArray(body?.attachments) ? body.attachments.map(String) : [],
  })
  return NextResponse.json({ ok: true, messageId: message.id })
})

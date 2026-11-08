import { NextResponse } from 'next/server'
import { withUser } from '@/server/lib/route-user'
import { supabase as db } from '@/server/db/client'

/** The provider a review is about reports it for moderation. */
export const POST = withUser<{ params: Promise<{ id: string }> }>(async ({ user, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (reason.length < 10) return NextResponse.json({ error: 'Tell us why in a sentence or two (10 characters or more)' }, { status: 400 })
  const { data: r } = await db.from('reviews').select('id, reviewee_id, is_flagged, hidden_at').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (r.reviewee_id !== user.id) return NextResponse.json({ error: 'You can only report reviews about you' }, { status: 403 })
  if (r.is_flagged) return NextResponse.json({ error: 'This review has already been reported — Servios is looking at it' }, { status: 409 })
  const { error } = await db.from('reviews').update({ is_flagged: true, flag_reason: reason, flagged_at: new Date().toISOString(), flagged_by: user.id }).eq('id', id)
  if (error) throw error
  return NextResponse.json({ ok: true })
})

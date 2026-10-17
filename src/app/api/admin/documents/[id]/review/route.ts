import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { loadProviderQueue } from '@/server/lib/verification'

/** Approve or reject one provider document. The DB trigger recomputes the
 *  provider's verification flags/status; the dispatch webhook emails and
 *  notifies the provider. Returns the provider's refreshed queue entry so
 *  the UI can say what the decision changed. */
export const POST = withAdmin<{ params: Promise<{ id: string }> }>(async ({ user, db, req, ctx }) => {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const action = body?.action
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const verifiedNumber = typeof body?.verifiedNumber === 'string' ? body.verifiedNumber.trim() : ''
  const issuer = typeof body?.issuer === 'string' ? body.issuer.trim() : ''
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : ''

  if (action !== 'approve' && action !== 'reject') throw new AdminInputError('action must be approve or reject')
  if (action === 'reject' && !reason) throw new AdminInputError('A reason is required when rejecting a document')

  const { data: doc, error } = await db.from('provider_documents').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!doc) throw new AdminInputError('Document not found')

  const now = new Date().toISOString()
  const update = action === 'approve'
    ? {
        status: 'approved',
        verified_at: now,
        verified_by: user.id,
        reviewed_at: now,
        verified_number: verifiedNumber || doc.credential_number || null,
        issuer: issuer || doc.issuer || null,
        review_notes: notes || null,
        rejection_reason: null,
      }
    : {
        status: 'rejected',
        rejection_reason: reason,
        reviewed_at: now,
        verified_by: user.id,
        verified_at: null,
        verified_number: null,
        review_notes: notes || null,
      }

  const { data: updated, error: updateError } = await db.from('provider_documents').update(update).eq('id', id).select('*').maybeSingle()
  if (updateError) throw updateError

  await logAdminAction(db, user.id, {
    action: action === 'approve' ? 'document.approve' : 'document.reject',
    targetTable: 'provider_documents',
    targetId: id,
    before: { status: doc.status, verified_number: doc.verified_number, rejection_reason: doc.rejection_reason },
    after: { status: update.status, verified_number: update.verified_number ?? null, rejection_reason: update.rejection_reason ?? null },
    reason: reason || notes || null,
  })

  const [provider] = await loadProviderQueue(db, { profileIds: [doc.provider_id], scope: 'all' })
  return NextResponse.json({ ok: true, document: updated, provider: provider ?? null })
})

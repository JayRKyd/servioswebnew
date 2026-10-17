import type { SupabaseClient } from '@supabase/supabase-js'

/** Shared shapes + loaders for the admin verification queue. */

export const DOC_TYPE_LABEL: Record<string, string> = {
  id: 'Photo ID',
  insurance: 'Public liability insurance',
  license: 'Trade licence / registration',
  certification: 'Certification',
  contract: 'Contract',
  other: 'Other document',
}

/** ID + insurance are what flips a provider to verified; licence and
 *  certification are optional and surface as credential badges. */
export const REQUIRED_DOC_TYPES = ['id', 'insurance'] as const
export const OPTIONAL_DOC_TYPES = ['license', 'certification'] as const

export type DocStatus = 'pending' | 'approved' | 'rejected' | 'expired'
export type RequiredState = DocStatus | 'missing'

export interface QueueDocument {
  id: string
  document_type: string
  title: string
  status: DocStatus
  credential_number: string | null
  issuer: string | null
  verified_number: string | null
  expiry_date: string | null
  rejection_reason: string | null
  review_notes: string | null
  created_at: string
  verified_at: string | null
  reviewed_at: string | null
  storage_path: string | null
  file_url: string | null
  signed_url: string | null
  kind: 'pdf' | 'image' | 'file' | 'none'
}

export interface QueueProvider {
  id: string
  user_id: string
  name: string
  business_name: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  trade_category: string | null
  city: string | null
  profile_image_url: string | null
  verification_status: string
  verification_override: boolean
  verification_notes: string | null
  verified_at: string | null
  identity_verified: boolean
  insurance_verified: boolean
  business_license_verified: boolean
  onboarding_complete: boolean
  created_at: string
  pending_count: number
  oldest_pending_at: string | null
  required: Record<(typeof REQUIRED_DOC_TYPES)[number], RequiredState>
  documents: QueueDocument[]
}

const PROVIDER_COLUMNS = 'id, user_id, business_name, first_name, last_name, phone, trade_category, city, profile_image_url, verification_status, verification_override, verification_notes, verified_at, identity_verified, insurance_verified, business_license_verified, onboarding_complete, created_at'
const DOCUMENT_COLUMNS = 'id, provider_id, document_type, title, status, credential_number, issuer, verified_number, expiry_date, rejection_reason, review_notes, created_at, verified_at, reviewed_at, storage_path, file_url'

function kindOf(path: string | null): QueueDocument['kind'] {
  if (!path) return 'none'
  const ext = path.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return 'image'
  return 'file'
}

/** The state of a required document type across all of a provider's uploads:
 *  an approved one wins, then pending, then expired/rejected, else missing. */
function requiredState(docs: QueueDocument[], type: string): RequiredState {
  const ofType = docs.filter(d => d.document_type === type)
  if (ofType.some(d => d.status === 'approved')) return 'approved'
  if (ofType.some(d => d.status === 'pending')) return 'pending'
  if (ofType.some(d => d.status === 'expired')) return 'expired'
  if (ofType.some(d => d.status === 'rejected')) return 'rejected'
  return 'missing'
}

export async function loadProviderQueue(db: SupabaseClient, opts: { profileIds?: string[]; scope?: 'queue' | 'all' } = {}): Promise<QueueProvider[]> {
  let providerQuery = db.from('provider_profiles').select(PROVIDER_COLUMNS).order('created_at', { ascending: true }).limit(500)
  if (opts.profileIds?.length) providerQuery = providerQuery.in('id', opts.profileIds)
  const { data: profiles, error: pErr } = await providerQuery
  if (pErr) throw pErr
  if (!profiles || profiles.length === 0) return []

  const profileIds = profiles.map(p => p.id)
  const userIds = profiles.map(p => p.user_id).filter(Boolean)
  const [{ data: docs, error: dErr }, { data: users }] = await Promise.all([
    db.from('provider_documents').select(DOCUMENT_COLUMNS).in('provider_id', profileIds).order('created_at', { ascending: true }),
    db.from('users').select('id, email, phone').in('id', userIds),
  ])
  if (dErr) throw dErr

  // One signed-URL round trip for every file in the queue (10 minutes)
  const paths = (docs ?? []).map(d => d.storage_path).filter((p): p is string => !!p)
  const signedByPath: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await db.storage.from('provider-documents').createSignedUrls(paths, 600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl
  }

  const userById = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  const docsByProvider: Record<string, QueueDocument[]> = {}
  for (const d of docs ?? []) {
    const doc: QueueDocument = {
      id: d.id,
      document_type: d.document_type,
      title: d.title,
      status: d.status,
      credential_number: d.credential_number ?? null,
      issuer: d.issuer ?? null,
      verified_number: d.verified_number ?? null,
      expiry_date: d.expiry_date ?? null,
      rejection_reason: d.rejection_reason ?? null,
      review_notes: d.review_notes ?? null,
      created_at: d.created_at,
      verified_at: d.verified_at ?? null,
      reviewed_at: d.reviewed_at ?? null,
      storage_path: d.storage_path ?? null,
      file_url: d.file_url ?? null,
      signed_url: d.storage_path ? (signedByPath[d.storage_path] ?? null) : null,
      kind: kindOf(d.storage_path ?? d.file_url ?? null),
    }
    ;(docsByProvider[d.provider_id] ??= []).push(doc)
  }

  const result: QueueProvider[] = profiles.map(p => {
    const documents = docsByProvider[p.id] ?? []
    const pendingDocs = documents.filter(d => d.status === 'pending')
    const u = userById[p.user_id]
    return {
      id: p.id,
      user_id: p.user_id,
      name: p.business_name?.trim() || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed provider',
      business_name: p.business_name ?? '',
      first_name: p.first_name ?? '',
      last_name: p.last_name ?? '',
      email: u?.email ?? null,
      phone: p.phone ?? u?.phone ?? null,
      trade_category: p.trade_category ?? null,
      city: p.city ?? null,
      profile_image_url: p.profile_image_url ?? null,
      verification_status: p.verification_status ?? 'unverified',
      verification_override: !!p.verification_override,
      verification_notes: p.verification_notes ?? null,
      verified_at: p.verified_at ?? null,
      identity_verified: !!p.identity_verified,
      insurance_verified: !!p.insurance_verified,
      business_license_verified: !!p.business_license_verified,
      onboarding_complete: !!p.onboarding_complete,
      created_at: p.created_at,
      pending_count: pendingDocs.length,
      oldest_pending_at: pendingDocs[0]?.created_at ?? null,
      required: {
        id: requiredState(documents, 'id'),
        insurance: requiredState(documents, 'insurance'),
      },
      documents,
    }
  })

  const inQueue = (p: QueueProvider) => p.pending_count > 0 || p.verification_status === 'pending'
  const filtered = opts.scope === 'all' ? result : result.filter(inQueue)

  // Oldest pending document first, then providers awaiting review with no
  // documents, then everyone else by signup date
  return filtered.sort((a, b) => {
    if (a.pending_count > 0 && b.pending_count > 0) return (a.oldest_pending_at ?? '').localeCompare(b.oldest_pending_at ?? '')
    if (a.pending_count > 0) return -1
    if (b.pending_count > 0) return 1
    const ap = a.verification_status === 'pending' ? 0 : 1
    const bp = b.verification_status === 'pending' ? 0 : 1
    if (ap !== bp) return ap - bp
    return a.created_at.localeCompare(b.created_at)
  })
}

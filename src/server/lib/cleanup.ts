import { supabase } from '../db/client'

/**
 * Launch cleanup: find placeholder / orphaned content and remove what the
 * admin ticks. Detection is read-only; removal is per item and reports
 * exactly what happened, so a foreign-key refusal never hides.
 */

export type CleanupKind = 'orphan_provider' | 'orphan_customer' | 'orphan_review' | 'default_bio' | 'duplicate_category' | 'seed_booking' | 'test_account'

export interface CleanupItem {
  kind: CleanupKind
  id: string
  label: string
  detail: string
  /** Keep-list hit — shown but not selectable */
  protectedReason?: string
}

const DEFAULT_BIO = 'A trusted and established member of the Servios community.'
/** Accounts the client asked us to keep for testing. */
const KEEP_EMAILS = new Set(['faizaansaeeed+prov1@gmail.com', 'fizzie5114+cust2@gmail.com', 'testadmin@servios.com'])
const TEST_EMAIL = /(^|[+.])test|@example\.com$|@servios\.com$|claude-wizard|@servios\.invalid$/i

async function allAuthUserIds(): Promise<Set<string>> {
  const ids = new Set<string>()
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) ids.add(u.id)
    if (data.users.length < 1000) break
  }
  return ids
}

export async function detectCleanup(): Promise<CleanupItem[]> {
  const items: CleanupItem[] = []
  const authIds = await allAuthUserIds()

  const [{ data: pps }, { data: cps }, { data: users }, { data: reviews }, { data: cats }, { data: seedBookings }] = await Promise.all([
    supabase.from('provider_profiles').select('id, user_id, business_name, first_name, last_name, bio, verification_status'),
    supabase.from('customer_profiles').select('id, user_id, first_name, last_name'),
    supabase.from('users').select('id, email, roles, status, created_at'),
    supabase.from('reviews').select('id, reviewer_id, reviewee_id, reviewer_name, rating, review_text, booking_id'),
    supabase.from('service_categories').select('id, name'),
    supabase.from('bookings').select('id, booking_number, status, total_amount').ilike('booking_number', 'BK-SEED-%'),
  ])
  const emailByUser = Object.fromEntries((users ?? []).map(u => [u.id, u.email]))
  const customerUserIds = new Set((cps ?? []).map(c => c.user_id))
  const providerUserIds = new Set((pps ?? []).map(p => p.user_id))

  for (const p of pps ?? []) {
    const name = p.business_name?.trim() || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed'
    const email = emailByUser[p.user_id] ?? '(no users row)'
    if (!authIds.has(p.user_id)) {
      items.push({ kind: 'orphan_provider', id: p.id, label: `${name} · ${email}`, detail: `Provider profile whose login account no longer exists (${p.verification_status}). Can't sign in or receive email.` })
    } else if (p.bio?.trim() === DEFAULT_BIO) {
      items.push({ kind: 'default_bio', id: p.id, label: `${name} · ${email}`, detail: 'Bio is the seeded placeholder sentence — clears it so the profile shows the real empty state.' })
    }
  }
  for (const c of cps ?? []) {
    if (!authIds.has(c.user_id)) {
      items.push({ kind: 'orphan_customer', id: c.id, label: `${`${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unnamed'} · ${emailByUser[c.user_id] ?? '(no users row)'}`, detail: 'Customer profile whose login account no longer exists.' })
    }
  }
  for (const r of reviews ?? []) {
    const hasProfile = customerUserIds.has(r.reviewer_id) || providerUserIds.has(r.reviewer_id)
    if (!hasProfile || !authIds.has(r.reviewer_id)) {
      const target = (pps ?? []).find(p => p.user_id === r.reviewee_id)
      items.push({ kind: 'orphan_review', id: r.id, label: `${r.rating}★ "${(r.review_text ?? '').slice(0, 60)}" on ${target?.business_name?.trim() || target?.first_name || 'provider'}`, detail: `Reviewer "${r.reviewer_name ?? 'Customer'}" has no account — a seeded review. Removing it recalculates the provider's rating.` })
    }
  }
  const byLower: Record<string, { id: string; name: string }[]> = {}
  for (const c of cats ?? []) (byLower[c.name.trim().toLowerCase()] ??= []).push(c)
  for (const group of Object.values(byLower)) {
    if (group.length < 2) continue
    const canonical = group.find(g => g.name === g.name.charAt(0).toUpperCase() + g.name.slice(1)) ?? group[0]
    for (const g of group) if (g.id !== canonical.id) items.push({ kind: 'duplicate_category', id: g.id, label: `"${g.name}" duplicates "${canonical.name}"`, detail: `Services in "${g.name}" are moved to "${canonical.name}" and the duplicate category is removed.` })
  }
  for (const b of seedBookings ?? []) {
    items.push({ kind: 'seed_booking', id: b.id, label: `${b.booking_number} · ${b.status} · £${(Number(b.total_amount) / 100).toFixed(2)}`, detail: 'Seeded booking (BK-SEED-…). Its photos, chat, reviews and disputes go with it.' })
  }
  for (const u of users ?? []) {
    if (!TEST_EMAIL.test(u.email)) continue
    const item: CleanupItem = { kind: 'test_account', id: u.id, label: `${u.email} · ${(u.roles ?? []).join(', ')}`, detail: `Test-looking account${authIds.has(u.id) ? '' : ' (no login account)'}. Deletes the login, profiles and anything only it owns; bookings with other parties are left and will show "Closed account".` }
    if (KEEP_EMAILS.has(u.email)) item.protectedReason = 'On the keep list (client test account)'
    if ((u.roles ?? []).includes('admin')) item.protectedReason = 'Admin account'
    items.push(item)
  }
  return items
}

export interface CleanupResult { kind: CleanupKind; id: string; outcome: string; ok: boolean }

async function del(table: string, col: string, val: string): Promise<string | null> {
  const { error } = await supabase.from(table).delete().eq(col, val)
  return error ? `${table}: ${error.message}` : null
}

async function removeProviderProfile(profileId: string): Promise<string[]> {
  const errs: string[] = []
  for (const t of ['provider_documents', 'provider_services', 'provider_availability', 'provider_portfolio_photos', 'provider_trade_services', 'quote_request_providers', 'preferred_providers']) {
    const e = await del(t, 'provider_id', profileId); if (e && !/does not exist/.test(e)) errs.push(e)
  }
  const e = await del('provider_profiles', 'id', profileId); if (e) errs.push(e)
  return errs
}

export async function runCleanup(items: { kind: CleanupKind; id: string }[], actorId: string): Promise<CleanupResult[]> {
  const results: CleanupResult[] = []
  const protectedIds = new Set((await detectCleanup()).filter(i => i.protectedReason).map(i => `${i.kind}:${i.id}`))
  for (const it of items) {
    if (protectedIds.has(`${it.kind}:${it.id}`)) { results.push({ ...it, ok: false, outcome: 'protected — on the keep list' }); continue }
    try {
      switch (it.kind) {
        case 'orphan_review': {
          const e = await del('reviews', 'id', it.id); results.push({ ...it, ok: !e, outcome: e ?? 'review removed; rating recalculated' }); break
        }
        case 'default_bio': {
          const { error } = await supabase.from('provider_profiles').update({ bio: null }).eq('id', it.id)
          results.push({ ...it, ok: !error, outcome: error?.message ?? 'placeholder bio cleared' }); break
        }
        case 'duplicate_category': {
          const { data: dup } = await supabase.from('service_categories').select('id, name').eq('id', it.id).maybeSingle()
          if (!dup) { results.push({ ...it, ok: false, outcome: 'category not found' }); break }
          const { data: all } = await supabase.from('service_categories').select('id, name').ilike('name', dup.name)
          const canonical = (all ?? []).find(c => c.id !== dup.id)
          if (!canonical) { results.push({ ...it, ok: false, outcome: 'no canonical category to merge into' }); break }
          await supabase.from('services').update({ category_id: canonical.id }).eq('category_id', dup.id)
          const e = await del('service_categories', 'id', dup.id)
          results.push({ ...it, ok: !e, outcome: e ?? `merged into "${canonical.name}"` }); break
        }
        case 'seed_booking': {
          const errs: string[] = []
          for (const t of ['booking_photos', 'reviews', 'dispute_messages']) { /* dispute_messages cascade via disputes */ if (t !== 'dispute_messages') { const e = await del(t, 'booking_id', it.id); if (e) errs.push(e) } }
          const e1 = await del('disputes', 'booking_id', it.id); if (e1) errs.push(e1)
          const e2 = await del('payments', 'booking_id', it.id); if (e2) errs.push(e2)
          const e3 = await del('booking_milestones', 'booking_id', it.id); if (e3) errs.push(e3)
          const e4 = await del('conversations', 'booking_id', it.id); if (e4) errs.push(e4)
          const e5 = await del('bookings', 'id', it.id); if (e5) errs.push(e5)
          results.push({ ...it, ok: errs.length === 0, outcome: errs.length ? errs.join('; ') : 'booking and its records removed' }); break
        }
        case 'orphan_provider': {
          const errs = await removeProviderProfile(it.id)
          results.push({ ...it, ok: errs.length === 0, outcome: errs.length ? errs.join('; ') : 'orphan provider profile removed' }); break
        }
        case 'orphan_customer': {
          const e = await del('customer_profiles', 'id', it.id); results.push({ ...it, ok: !e, outcome: e ?? 'orphan customer profile removed' }); break
        }
        case 'test_account': {
          const errs: string[] = []
          const { data: pp } = await supabase.from('provider_profiles').select('id').eq('user_id', it.id).maybeSingle()
          if (pp) errs.push(...await removeProviderProfile(pp.id))
          const ec = await del('customer_profiles', 'user_id', it.id); if (ec) errs.push(ec)
          for (const t of ['notifications', 'push_tokens', 'conversation_reads']) { const e = await del(t, 'user_id', it.id); if (e && !/does not exist/.test(e)) errs.push(e) }
          const eu = await del('users', 'id', it.id); if (eu) errs.push(eu)
          const { error: ea } = await supabase.auth.admin.deleteUser(it.id); if (ea && !/not found/i.test(ea.message)) errs.push(`auth: ${ea.message}`)
          results.push({ ...it, ok: errs.length === 0, outcome: errs.length ? `partial — ${errs.join('; ')}` : 'account deleted' }); break
        }
      }
    } catch (e: any) {
      results.push({ ...it, ok: false, outcome: e?.message ?? 'failed' })
    }
  }
  await supabase.from('admin_actions').insert({ actor_id: actorId, action: 'cleanup.run', target_table: 'mixed', target_id: null, after: results })
  return results
}

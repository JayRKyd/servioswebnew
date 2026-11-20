import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { getSettings, getVatNumber, normaliseVatNumber, SETTING_LIMITS, type SettingKey } from '@/server/lib/settings'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async () => {
  return NextResponse.json({ settings: await getSettings(), limits: SETTING_LIMITS, vatNumber: await getVatNumber() })
})

/** Update one or more policy numbers. Changing a payout delay applies to each
 *  provider the next time their delay is refreshed (after their next job). */
export const POST = withAdmin(async ({ user, db, req }) => {
  const body = await req.json().catch(() => ({}))
  // Company details are text, handled apart from the policy numbers
  if (body && 'vat_number' in body) {
    let vat: string | null
    try { vat = normaliseVatNumber(body.vat_number) } catch (e) { throw new AdminInputError(e instanceof Error ? e.message : 'Invalid VAT number') }
    const was = await getVatNumber()
    const { error } = vat
      ? await db.from('platform_settings').upsert({ key: 'vat_number', value: vat, updated_at: new Date().toISOString(), updated_by: user.id })
      : await db.from('platform_settings').delete().eq('key', 'vat_number')
    if (error) throw error
    await logAdminAction(db, user.id, { action: 'settings.vat_number', targetTable: 'platform_settings', before: { vat_number: was }, after: { vat_number: vat } })
    return NextResponse.json({ ok: true, vatNumber: vat })
  }
  const before = await getSettings()
  const rows: { key: string; value: number; updated_at: string; updated_by: string }[] = []
  for (const [key, raw] of Object.entries(body ?? {})) {
    if (!(key in SETTING_LIMITS)) throw new AdminInputError(`Unknown setting ${key}`)
    const limits = SETTING_LIMITS[key as SettingKey]
    const value = Number(raw)
    if (!Number.isInteger(value) || value < limits.min || value > limits.max) {
      throw new AdminInputError(`${limits.label} must be a whole number from ${limits.min} to ${limits.max}`)
    }
    rows.push({ key, value, updated_at: new Date().toISOString(), updated_by: user.id })
  }
  if (!rows.length) throw new AdminInputError('Nothing to save')
  const { error } = await db.from('platform_settings').upsert(rows)
  if (error) throw error
  const after = await getSettings()
  await logAdminAction(db, user.id, { action: 'settings.update', targetTable: 'platform_settings', before, after })
  return NextResponse.json({ ok: true, settings: after })
})

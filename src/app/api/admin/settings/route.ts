import { NextResponse } from 'next/server'
import { withAdmin, logAdminAction, AdminInputError } from '@/server/lib/admin'
import { getSettings, SETTING_LIMITS, type SettingKey } from '@/server/lib/settings'

export const dynamic = 'force-dynamic'

export const GET = withAdmin(async () => {
  return NextResponse.json({ settings: await getSettings(), limits: SETTING_LIMITS })
})

/** Update one or more policy numbers. Changing a payout delay applies to each
 *  provider the next time their delay is refreshed (after their next job). */
export const POST = withAdmin(async ({ user, db, req }) => {
  const body = await req.json().catch(() => ({}))
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

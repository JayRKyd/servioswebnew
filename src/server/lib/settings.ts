import { supabase } from '../db/client'

/** Policy numbers the client can change from the admin panel. Defaults are
 *  the 2026-10-18 decisions and apply when a row is missing. */
export const SETTING_DEFAULTS = {
  dispute_window_days: 30,
  payout_delay_days: 7,
  new_provider_payout_delay_days: 14,
  new_provider_job_threshold: 5,
  // After an upheld dispute the longer delay lasts until BOTH are met
  // (client decision, 2026-11-22)
  upheld_reset_jobs: 5,
  upheld_reset_days: 30,
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS
export type PlatformSettings = { [K in SettingKey]: number }

/** Stripe won't schedule UK payouts sooner than this. */
export const UK_MIN_PAYOUT_DELAY_DAYS = 7

export const SETTING_LIMITS: Record<SettingKey, { min: number; max: number; label: string; help: string }> = {
  dispute_window_days: { min: 1, max: 120, label: 'Dispute window (days)', help: 'How long after confirming a job a customer can report a problem. Not a payout freeze.' },
  payout_delay_days: { min: UK_MIN_PAYOUT_DELAY_DAYS, max: 31, label: 'Payout clearing delay (days)', help: 'Days between a provider being paid and the money reaching their bank. Stripe’s UK minimum is 7.' },
  new_provider_payout_delay_days: { min: UK_MIN_PAYOUT_DELAY_DAYS, max: 31, label: 'New-provider clearing delay (days)', help: 'Applies to a provider’s first jobs, and again after a dispute is upheld against them.' },
  new_provider_job_threshold: { min: 0, max: 50, label: 'Jobs before standard delay', help: 'Confirmed jobs before a new provider moves to the standard delay.' },
  upheld_reset_jobs: { min: 0, max: 50, label: 'Clean jobs after an upheld dispute', help: 'After a dispute is upheld against a provider they go on the new-provider delay. This many confirmed jobs with no further upheld dispute are needed to return to the standard delay.' },
  upheld_reset_days: { min: 0, max: 365, label: 'Minimum days after an upheld dispute', help: 'The longer delay also lasts at least this many days from the decision. A new upheld dispute restarts both counts. Lost bank chargebacks do not count.' },
}

export async function getSettings(): Promise<PlatformSettings> {
  const { data } = await supabase.from('platform_settings').select('key, value')
  const out = { ...SETTING_DEFAULTS } as PlatformSettings
  for (const row of data ?? []) {
    if (row.key in out) {
      const n = Number(row.value)
      if (Number.isFinite(n)) out[row.key as SettingKey] = n
    }
  }
  return out
}

/* ── Company details ──────────────────────────────────────────────────────── */

/** "GB123456789" from whatever was typed; null clears it. Throws on a value
 *  that isn't a UK VAT number (9 digits, or 12 for a branch trader). */
export function normaliseVatNumber(raw: unknown): string | null {
  const v = String(raw ?? '').toUpperCase().replace(/[\s.-]/g, '')
  if (!v) return null
  const digits = v.replace(/^GB/, '')
  if (!/^(\d{9}|\d{12})$/.test(digits)) throw new Error('A UK VAT number is GB followed by 9 digits, for example GB123456789')
  return `GB${digits}`
}

/** Servios's VAT registration number, or null when not registered / not set.
 *  Receipts and provider statements only mention VAT when this is set. */
export async function getVatNumber(): Promise<string | null> {
  const { data } = await supabase.from('platform_settings').select('value').eq('key', 'vat_number').maybeSingle()
  const v = typeof data?.value === 'string' ? data.value.trim() : ''
  return v || null
}

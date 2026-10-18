import { supabase } from '../db/client'

/** Policy numbers the client can change from the admin panel. Defaults are
 *  the 2026-10-18 decisions and apply when a row is missing. */
export const SETTING_DEFAULTS = {
  dispute_window_days: 30,
  payout_delay_days: 7,
  new_provider_payout_delay_days: 14,
  new_provider_job_threshold: 5,
} as const

export type SettingKey = keyof typeof SETTING_DEFAULTS
export type PlatformSettings = { [K in SettingKey]: number }

/** Stripe won't schedule UK payouts sooner than this. */
export const UK_MIN_PAYOUT_DELAY_DAYS = 7

export const SETTING_LIMITS: Record<SettingKey, { min: number; max: number; label: string; help: string }> = {
  dispute_window_days: { min: 1, max: 120, label: 'Dispute window (days)', help: 'How long after confirming a job a customer can report a problem. Not a payout freeze.' },
  payout_delay_days: { min: UK_MIN_PAYOUT_DELAY_DAYS, max: 31, label: 'Payout clearing delay (days)', help: 'Days between a provider being paid and the money reaching their bank. Stripe’s UK minimum is 7.' },
  new_provider_payout_delay_days: { min: UK_MIN_PAYOUT_DELAY_DAYS, max: 31, label: 'New-provider clearing delay (days)', help: 'Applies until a provider has completed the threshold number of jobs with no upheld disputes.' },
  new_provider_job_threshold: { min: 0, max: 50, label: 'Jobs before standard delay', help: 'Completed jobs (with no upheld disputes) before a provider moves to the standard delay.' },
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

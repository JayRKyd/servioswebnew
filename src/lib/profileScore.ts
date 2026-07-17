/** Profile completeness score (0–100) used as a ranking signal: complete
 *  profiles surface above bare/incomplete ones when rating and track record
 *  don't separate providers (e.g. new marketplaces, new providers). Accepts
 *  partial rows — score only what the caller selected. */
export function profileCompletenessScore(p: {
  profile_image_url?: string | null
  avatar_url?: string | null
  bio?: string | null
  trade_category?: string | null
  hourly_rate?: number | null
  service_areas?: string[] | null
  islands?: string[] | null
  city?: string | null
  licenses?: string[] | null
  languages?: string[] | null
  identity_verified?: boolean | null
}): number {
  let score = 0
  if (p.profile_image_url || p.avatar_url) score += 15
  if ((p.bio ?? '').trim().length >= 20) score += 20
  if (p.trade_category) score += 10
  if (p.hourly_rate != null && Number(p.hourly_rate) > 0) score += 15
  const areas = (p.service_areas ?? p.islands ?? []) as string[]
  if (areas.length > 0 || p.city) score += 15
  if ((p.licenses ?? []).length > 0) score += 10
  if ((p.languages ?? []).length > 0) score += 5
  if (p.identity_verified) score += 10
  return score
}

export interface UpheldProgress { at: string; jobsSince: number; jobsNeeded: number; daysSince: number; daysNeeded: number; cleared: boolean }

export interface PayoutTermsView {
  days: number
  reason: 'custom' | 'new_provider' | 'upheld_dispute' | 'standard'
  jobsDone: number
  jobThreshold: number
  standardDays: number
  newProviderDays: number
  upheld?: UpheldProgress | null
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "2 more jobs and 12 more days to go" — what is still needed to get back to
 *  the standard delay after an upheld dispute. */
export function upheldProgress(u: UpheldProgress): string {
  const jobsLeft = Math.max(0, u.jobsNeeded - u.jobsSince)
  const daysLeft = Math.max(0, u.daysNeeded - u.daysSince)
  const parts = [jobsLeft > 0 ? plural(jobsLeft, 'more job') : '', daysLeft > 0 ? plural(daysLeft, 'more day') : ''].filter(Boolean)
  return parts.length ? `${parts.join(' and ')} to go` : 'conditions met'
}

/** One or two sentences telling a provider which clearing delay applies to them. */
export function describePayoutTerms(t: PayoutTermsView): string {
  switch (t.reason) {
    case 'custom':
      return `Your payments clear to your bank ${t.days} days after each job is confirmed. This delay was set for your account by the Servios team.`
    case 'new_provider': {
      const left = Math.max(0, t.jobThreshold - t.jobsDone)
      return `Your payments clear to your bank ${t.days} days after each job is confirmed, because you are on the new-provider delay (${t.jobsDone} of ${t.jobThreshold} jobs done). After ${plural(left, 'more confirmed job')} it drops to ${t.standardDays} days.`
    }
    case 'upheld_dispute': {
      const u = t.upheld
      if (!u) return `Your payments clear to your bank ${t.days} days after each job is confirmed. The longer delay applies because a problem report was upheld on one of your jobs.`
      return `Your payments clear to your bank ${t.days} days after each job is confirmed, because a problem report was upheld on one of your jobs. It returns to ${t.standardDays} days after ${plural(u.jobsNeeded, 'confirmed job')} with no further upheld report and at least ${u.daysNeeded} days: ${u.jobsSince} of ${u.jobsNeeded} jobs done, ${upheldProgress(u)}.`
    }
    default:
      return `Your payments clear to your bank ${t.days} days after each job is confirmed. This is the standard delay.`
  }
}

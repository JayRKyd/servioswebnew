export interface PayoutTermsView {
  days: number
  reason: 'custom' | 'new_provider' | 'upheld_dispute' | 'standard'
  jobsDone: number
  jobThreshold: number
  standardDays: number
  newProviderDays: number
}

/** One sentence telling a provider which clearing delay applies to them. */
export function describePayoutTerms(t: PayoutTermsView): string {
  switch (t.reason) {
    case 'custom':
      return `Your payments clear to your bank ${t.days} days after each job is confirmed. This delay was set for your account by the Servios team.`
    case 'new_provider': {
      const left = Math.max(0, t.jobThreshold - t.jobsDone)
      return `Your payments clear to your bank ${t.days} days after each job is confirmed, because you are on the new-provider delay (${t.jobsDone} of ${t.jobThreshold} jobs done). After ${left} more confirmed job${left === 1 ? '' : 's'} it drops to ${t.standardDays} days.`
    }
    case 'upheld_dispute':
      return `Your payments clear to your bank ${t.days} days after each job is confirmed. The longer delay applies because a problem report was upheld on one of your jobs. Contact support if you think this should be reviewed.`
    default:
      return `Your payments clear to your bank ${t.days} days after each job is confirmed. This is the standard delay.`
  }
}

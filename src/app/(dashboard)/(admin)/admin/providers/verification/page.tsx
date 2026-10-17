import { redirect } from 'next/navigation'

// The verification queue moved to /admin/verification (Phase 1 of the admin
// panel plan); old links from the admin home banner still land there.
export default function LegacyVerificationRedirect() {
  redirect('/admin/verification')
}

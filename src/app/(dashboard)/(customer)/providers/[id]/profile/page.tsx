import { redirect } from 'next/navigation'

/** Legacy route — the app used to ship two public profile layouts with
 *  drifting content (name shown three times, two "Member since" formats,
 *  a public tel: link). /providers/[id] is the single canonical profile. */
export default async function LegacyProfileRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/providers/${id}`)
}

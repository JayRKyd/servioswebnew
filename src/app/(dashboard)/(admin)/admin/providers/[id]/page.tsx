'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { BadgeCheck, Shield, CreditCard, Award, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/auth'
import { formatDate, titleCase } from '@/lib/utils'

const STATUS: Record<string, { label: string; cls: string }> = {
  verified:   { label: 'Verified',        cls: 'bg-green-100 text-green-700' },
  pending:    { label: 'Awaiting review', cls: 'bg-amber-100 text-amber-700' },
  unverified: { label: 'Not submitted',   cls: 'bg-gray-100 text-gray-600' },
  rejected:   { label: 'Rejected',        cls: 'bg-red-100 text-red-700' },
}

/** Read-only provider summary for admins. Every verification decision lives
 *  in the Verification queue so it's audited and emails the provider. */
export default function AdminProviderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('provider_profiles').select('*').eq('user_id', id).maybeSingle().then(({ data: p }) => {
      setProfile(p)
      if (p?.id) {
        supabase.from('provider_documents').select('*').eq('provider_id', p.id).order('created_at', { ascending: false })
          .then(({ data: d }) => { setDocs(d ?? []); setLoading(false) })
      } else {
        setLoading(false)
      }
    })
  }, [id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!profile) return <div className="text-gray-400">Provider not found.</div>

  const status = STATUS[profile.verification_status] ?? STATUS.unverified
  const name = profile.business_name?.trim() || `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()

  const flags = [
    { label: 'Photo ID', ok: !!profile.identity_verified, icon: CreditCard, extra: profile.identity_verified_at ? `since ${formatDate(profile.identity_verified_at)}` : 'not approved' },
    { label: 'Insurance', ok: !!profile.insurance_verified, icon: Shield, extra: profile.insurance_expiry_date ? `expires ${formatDate(profile.insurance_expiry_date)}` : (profile.insurance_verified ? 'no expiry on file' : 'not approved') },
    { label: 'Licence / certification', ok: !!profile.business_license_verified, icon: Award, extra: profile.business_license_expiry_date ? `expires ${formatDate(profile.business_license_expiry_date)}` : (profile.business_license_verified ? 'approved' : 'none approved') },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{titleCase(name)}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
        {profile.verification_override && profile.verification_status === 'verified' && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Verified manually</span>
        )}
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
        <div className="flex items-start gap-4">
          {profile.profile_image_url ? (
            <img src={profile.profile_image_url} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-gray-200" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{(name || '?').charAt(0)}</div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900">{titleCase(profile.first_name ?? '')} {titleCase(profile.last_name ?? '')}</p>
            <p className="text-xs text-gray-500">
              {[profile.trade_category && titleCase(profile.trade_category), profile.city, profile.phone].filter(Boolean).join(' · ')}
            </p>
            {profile.bio && <p className="mt-2 text-sm text-gray-600">{profile.bio}</p>}
            {profile.verification_notes && (
              <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600"><span className="font-semibold">Admin note:</span> {profile.verification_notes}</p>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {flags.map(f => {
            const Icon = f.icon
            return (
              <div key={f.label} className={`rounded-xl px-3 py-2.5 ${f.ok ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                <p className="flex items-center gap-1.5 text-xs font-semibold"><Icon size={13} /> {f.label}</p>
                <p className="mt-0.5 text-[11px]">{f.ok ? 'Approved' : 'Not approved'} · {f.extra}</p>
              </div>
            )
          })}
        </div>

        {docs.length > 0 && (
          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium text-gray-900">Documents</p>
            <div className="space-y-2">
              {docs.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{d.title}{d.verified_number ? <span className="text-gray-500"> · {d.verified_number}</span> : null}</p>
                    <p className="text-xs capitalize text-gray-400">{d.document_type}{d.expiry_date ? ` · expires ${formatDate(d.expiry_date)}` : ''}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${d.status === 'approved' ? 'bg-green-100 text-green-700' : d.status === 'rejected' ? 'bg-red-100 text-red-700' : d.status === 'expired' ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>{d.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <Link href={`/admin/verification?provider=${profile.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark">
            <BadgeCheck size={15} /> Review in verification queue <ArrowRight size={14} />
          </Link>
          <p className="mt-2 text-xs text-gray-400">Approvals, rejections and manual decisions are made there so each one is logged and the provider is notified.</p>
        </div>
      </div>
    </div>
  )
}

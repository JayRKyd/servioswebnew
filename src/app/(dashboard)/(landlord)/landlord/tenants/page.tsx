'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate } from '@/lib/utils'

export default function LandlordTenantsPage() {
  const { landlordId } = useProfileIds()
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!landlordId) return
    supabase.from('tenants').select('*, properties(name)').eq('landlord_id', landlordId).order('created_at', { ascending: false })
      .then(({ data }) => { setTenants(data ?? []); setLoading(false) })
  }, [landlordId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <Link href="/landlord/tenants/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">+ Add Tenant</Link>
      </div>
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        tenants.length === 0 ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-center"><div><p className="text-gray-400">No tenants yet</p></div></div> : (
          <div className="space-y-3">
            {tenants.map(t => (
              <Link key={t.id} href={'/landlord/tenants/' + t.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">
                <div>
                  <p className="font-semibold text-gray-900">{t.first_name} {t.last_name}</p>
                  <p className="text-sm text-gray-500">{t.properties?.name}{t.unit_number ? ' · Unit ' + t.unit_number : ''}</p>
                  {t.email && <p className="text-xs text-gray-400">{t.email}</p>}
                </div>
                <div className="text-right">
                  {t.lease_end && <p className="text-xs text-gray-400">Lease ends {formatDate(t.lease_end)}</p>}
                  <span className={'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ' + (t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                    {t.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )
      }
    </div>
  )
}

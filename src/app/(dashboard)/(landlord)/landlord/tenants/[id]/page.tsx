'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

export default function TenantDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('tenants').select('*, properties(name, address)').eq('id', id).single()
      .then(({ data }) => { setTenant(data); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!tenant) return <div className="text-gray-400">Tenant not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{tenant.first_name} {tenant.last_name}</h1>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[['Property', tenant.properties?.name], ['Unit', tenant.unit_number ?? '—'], ['Email', tenant.email ?? '—'], ['Phone', tenant.phone ?? '—'], ['Lease Start', tenant.lease_start ? formatDate(tenant.lease_start) : '—'], ['Lease End', tenant.lease_end ? formatDate(tenant.lease_end) : '—']].map(([label, val]) => (
            <div key={label as string}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="font-medium text-gray-900">{val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

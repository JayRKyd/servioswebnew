'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate } from '@/lib/utils'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  emergency: 'bg-red-100 text-red-700',
}
function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (PRIORITY_COLORS[priority] ?? 'bg-gray-100 text-gray-700')}>
      {priority}
    </span>
  )
}

export default function TenantDashboard() {
  const { tenantId } = useProfileIds()
  const { user } = useAuth()
  const [tenancy, setTenancy] = useState<any>(null)
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !tenantId) return
    Promise.all([
      supabase.from('tenants').select('*, properties(name, address)').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('maintenance_requests').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(3),
      supabase.from('tenant_profiles').select('*').eq('id', tenantId).single(),
    ]).then(([{ data: t }, { data: m }, { data: p }]) => {
      setTenancy(t)
      setMaintenance(m ?? [])
      setProfile(p)
      setLoading(false)
    })
  }, [user?.id, tenantId])

  const name = profile?.first_name ?? 'Tenant'
  const pending = maintenance.filter(m => m.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-primary p-6 text-white">
        <h1 className="text-2xl font-bold">Hi, {name}</h1>
        {tenancy ? <p className="mt-1 text-white/70">{tenancy.properties?.name}{tenancy.unit_number ? ' · Unit ' + tenancy.unit_number : ''}</p> : <p className="mt-1 text-white/70">No active tenancy</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Report Issue', '/tenant/maintenance/new'], ['My Property', '/tenant/property'], ['Chat Landlord', '/tenant/chat'], ['Emergency', '/tenant/emergency']] as const).map(([label, href]) => (
          <Link key={label} href={href} className={'rounded-xl p-4 text-center text-sm font-semibold shadow-sm ring-1 ring-gray-100 transition hover:ring-primary/30 ' + (label === 'Emergency' ? 'bg-red-50 text-red-600 ring-red-200' : 'bg-white text-gray-700')}>{label}</Link>
        ))}
      </div>

      {tenancy && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <p className="text-sm font-semibold text-gray-900 mb-2">Lease Info</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {tenancy.lease_start && <div><p className="text-xs text-gray-400">Lease Start</p><p className="font-medium">{formatDate(tenancy.lease_start)}</p></div>}
            {tenancy.lease_end && <div><p className="text-xs text-gray-400">Lease End</p><p className="font-medium">{formatDate(tenancy.lease_end)}</p></div>}
          </div>
        </div>
      )}

      {maintenance.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Recent Requests</h2>
            <Link href="/tenant/maintenance" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {maintenance.map(m => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{m.title}</p>
                  <p className="text-xs text-gray-400">{formatDate(m.created_at)}</p>
                </div>
                <PriorityBadge priority={m.priority} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

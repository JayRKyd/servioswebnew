'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'

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

export default function LandlordDashboard() {
  const { landlordId } = useProfileIds()
  const [properties, setProperties] = useState<any[]>([])
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!landlordId) return
    Promise.all([
      supabase.from('properties').select('*').eq('landlord_id', landlordId),
      supabase.from('maintenance_requests').select('*').eq('landlord_id', landlordId).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('landlord_profiles').select('*').eq('id', landlordId).single(),
    ]).then(([{ data: p }, { data: m }, { data: prof }]) => {
      setProperties(p ?? [])
      setMaintenance(m ?? [])
      setProfile(prof)
      setLoading(false)
    })
  }, [landlordId])

  const name = profile?.first_name ?? 'Landlord'

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-primary p-6 text-white">
        <h1 className="text-2xl font-bold">Hi, {name}</h1>
        <p className="mt-1 text-white/70">{properties.length} properties · {maintenance.length} pending maintenance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([['Properties', properties.length], ['Pending Maintenance', maintenance.length], ['Active Tenants', '—']] as const).map(([label, val]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{val}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Properties', '/landlord/properties'], ['Tenants', '/landlord/tenants'], ['Maintenance', '/landlord/maintenance'], ['Messages', '/messages']] as const).map(([label, href]) => (
          <Link key={label} href={href} className="rounded-xl bg-white p-4 text-center text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-100 transition hover:ring-primary/30">{label}</Link>
        ))}
      </div>

      {maintenance.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Pending Maintenance</h2>
          <div className="space-y-3">
            {maintenance.map(m => (
              <Link key={m.id} href={'/landlord/maintenance/' + m.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-primary/30">
                <div>
                  <p className="font-medium text-gray-900">{m.title}</p>
                  <p className="text-xs text-gray-400">{m.description?.slice(0, 60)}</p>
                </div>
                <PriorityBadge priority={m.priority} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

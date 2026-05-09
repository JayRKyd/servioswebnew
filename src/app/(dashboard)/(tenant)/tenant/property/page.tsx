'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export default function TenantPropertyPage() {
  const { user } = useAuth()
  const [tenancy, setTenancy] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('tenants').select('*, properties(*)').eq('user_id', user.id).eq('is_active', true).single()
      .then(({ data }) => { setTenancy(data); setLoading(false) })
  }, [user?.id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!tenancy) return <div className="text-gray-400">No active tenancy found.</div>

  const p = tenancy.properties

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Property</h1>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div>
          <p className="text-lg font-bold text-gray-900">{p.name}</p>
          <p className="text-sm text-gray-500">{p.address?.street}, {p.address?.island}</p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          {tenancy.unit_number && <div><p className="text-xs text-gray-400">Unit</p><p className="font-medium">{tenancy.unit_number}</p></div>}
          <div><p className="text-xs text-gray-400">Type</p><p className="font-medium capitalize">{p.property_type?.replace('_', ' ')}</p></div>
          {p.bedrooms && <div><p className="text-xs text-gray-400">Bedrooms</p><p className="font-medium">{p.bedrooms}</p></div>}
          {p.bathrooms && <div><p className="text-xs text-gray-400">Bathrooms</p><p className="font-medium">{p.bathrooms}</p></div>}
        </div>
        {p.notes && (
          <div className="border-t pt-4">
            <p className="text-xs text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{p.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

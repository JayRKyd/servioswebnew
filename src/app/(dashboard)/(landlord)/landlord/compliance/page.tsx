'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'

export default function LandlordCompliancePage() {
  const { user } = useAuth()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('property_compliance')
      .select('*, properties!inner(name, landlord_id)')
      .eq('properties.landlord_id', user.id)
      .order('due_date', { ascending: true })
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [user?.id])

  const overdue = items.filter(i => i.status === 'overdue')
  const pending = items.filter(i => i.status === 'pending')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([['Overdue', overdue.length, 'text-red-600'], ['Pending', pending.length, 'text-yellow-600'], ['Total Items', items.length, 'text-gray-900']] as const).map(([label, count, cls]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={'mt-1 text-3xl font-bold ' + cls}>{count}</p>
          </div>
        ))}
      </div>
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        items.length === 0 ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No compliance items</p></div> : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex items-start justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div>
                  <p className="font-semibold text-gray-900">{item.item}</p>
                  <p className="text-sm text-gray-500">{item.properties?.name}</p>
                  {item.due_date && <p className="text-xs text-gray-400">Due {formatDate(item.due_date)}</p>}
                </div>
                <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (item.status === 'compliant' ? 'bg-green-100 text-green-700' : item.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

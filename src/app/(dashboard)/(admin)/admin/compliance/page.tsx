'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

export default function AdminCompliancePage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('property_compliance').select('*, properties(name, landlord_id)').eq('status', 'overdue').order('due_date', { ascending: true })
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
      {items.length > 0 && <div className="rounded-lg bg-red-50 p-4 border border-red-200"><p className="text-sm font-medium text-red-800">{items.length} overdue compliance items across all properties</p></div>}
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        items.length === 0 ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No overdue compliance items</p></div> : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-red-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{item.item}</p>
                    <p className="text-sm text-gray-500">{item.properties?.name}</p>
                    {item.due_date && <p className="text-xs text-red-500">Overdue since {formatDate(item.due_date)}</p>}
                  </div>
                  <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Overdue</span>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

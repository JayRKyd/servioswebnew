'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

export default function PropertyCompliancePage() {
  const { id } = useParams()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('property_compliance').select('*').eq('property_id', id).order('due_date', { ascending: true })
      .then(({ data }) => { setItems(data ?? []); setLoading(false) })
  }, [id])

  const overdue = items.filter(i => i.status === 'overdue').length
  const pending = items.filter(i => i.status === 'pending').length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
      {(overdue > 0 || pending > 0) && (
        <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 border border-yellow-200">
          {overdue > 0 && <p>{overdue} overdue item{overdue !== 1 ? 's' : ''}</p>}
          {pending > 0 && <p>{pending} pending item{pending !== 1 ? 's' : ''}</p>}
        </div>
      )}
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        items.length === 0 ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No compliance items</p></div> : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{item.item}</p>
                    {item.category && <p className="text-xs text-gray-400">{item.category}</p>}
                    {item.due_date && <p className="mt-1 text-xs text-gray-500">Due: {formatDate(item.due_date)}</p>}
                  </div>
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (item.status === 'compliant' ? 'bg-green-100 text-green-700' : item.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

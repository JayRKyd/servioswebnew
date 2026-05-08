'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
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
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  accepted: 'bg-blue-100 text-primary',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-primary',
  open: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  under_review: 'bg-orange-100 text-orange-700',
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function TenantMaintenancePage() {
  const { tenantId } = useProfileIds()
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId) return
    supabase.from('maintenance_requests').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
      .then(({ data }) => { setRequests(data ?? []); setLoading(false) })
  }, [tenantId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
        <Link href="/tenant/maintenance/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">+ Report Issue</Link>
      </div>
      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        requests.length === 0 ? <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No requests</p></div> : (
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-400">{formatDate(r.created_at)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={r.status} />
                    <PriorityBadge priority={r.priority} />
                  </div>
                </div>
                {r.description && <p className="mt-2 text-sm text-gray-500 line-clamp-2">{r.description}</p>}
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

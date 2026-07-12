'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
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
  accepted: 'bg-primary/10 text-primary',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  scheduled: 'bg-primary/10 text-primary',
  open: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
}
function StatusBadge({ status }: { status: string }) {
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function MaintenanceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [request, setRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    supabase.from('maintenance_requests').select('*, properties(name, address)').eq('id', id).single()
      .then(({ data }) => { setRequest(data); setLoading(false) })
  }, [id])

  async function updateStatus(status: string) {
    setActing(true)
    await supabase.from('maintenance_requests').update({ status }).eq('id', id)
    setRequest((r: any) => ({ ...r, status }))
    setActing(false)
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!request) return <div className="text-gray-400">Request not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{request.title}</h1>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div className="flex items-center gap-2"><StatusBadge status={request.status} /><PriorityBadge priority={request.priority} /></div>
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div><p className="text-xs text-gray-400">Property</p><p className="font-medium">{request.properties?.name}</p></div>
          <div><p className="text-xs text-gray-400">Submitted</p><p className="font-medium">{formatDate(request.created_at)}</p></div>
        </div>
        {request.description && <div className="border-t pt-4"><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-700">{request.description}</p></div>}
      </div>
      <div className="flex flex-wrap gap-3">
        {request.status === 'pending' && <button onClick={() => updateStatus('approved')} disabled={acting} className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">Approve</button>}
        {request.status === 'approved' && <button onClick={() => updateStatus('scheduled')} disabled={acting} className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">Mark Scheduled</button>}
        {['pending', 'approved'].includes(request.status) && <button onClick={() => updateStatus('cancelled')} disabled={acting} className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Cancel</button>}
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

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

export default function AdminDisputeDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [dispute, setDispute] = useState<any>(null)
  const [resolution, setResolution] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    supabase.from('disputes').select('*').eq('id', id).single().then(({ data }) => { setDispute(data); setLoading(false) })
  }, [id])

  async function resolve() {
    setActing(true)
    await supabase.from('disputes').update({ status: 'resolved', resolution, resolved_at: new Date().toISOString() }).eq('id', id)
    setDispute((d: any) => ({ ...d, status: 'resolved', resolution }))
    setActing(false)
  }

  async function markReviewing() {
    setActing(true)
    await supabase.from('disputes').update({ status: 'under_review' }).eq('id', id)
    setDispute((d: any) => ({ ...d, status: 'under_review' }))
    setActing(false)
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!dispute) return <div className="text-gray-400">Dispute not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Dispute</h1>
        <StatusBadge status={dispute.status} />
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <div><p className="text-xs text-gray-400 mb-1">Reason</p><p className="text-sm text-gray-700">{dispute.reason}</p></div>
        {dispute.description && <div className="border-t pt-4"><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-700">{dispute.description}</p></div>}
        <div className="border-t pt-4"><p className="text-xs text-gray-400">Opened</p><p className="font-medium">{formatDate(dispute.created_at)}</p></div>
        {dispute.resolution && <div className="border-t pt-4 rounded-lg bg-green-50 p-3"><p className="text-xs text-gray-400 mb-1">Resolution</p><p className="text-sm text-green-800">{dispute.resolution}</p></div>}
      </div>
      {['open', 'under_review'].includes(dispute.status) && (
        <div className="space-y-3 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 className="font-semibold text-gray-900">Take Action</h2>
          {dispute.status === 'open' && (
            <button onClick={markReviewing} disabled={acting} className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50">Mark Under Review</button>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
            <textarea rows={3} value={resolution} onChange={e => setResolution(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button onClick={resolve} disabled={acting || !resolution.trim()} className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Mark Resolved</button>
        </div>
      )}
    </div>
  )
}

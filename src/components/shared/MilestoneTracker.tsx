'use client'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Milestone {
  id: string
  milestone_number: number
  title: string
  amount: number | string
  due_date?: string | null
  status: 'pending' | 'active' | 'completed' | 'released' | string
}

interface MilestoneTrackerProps {
  milestones: Milestone[]
  isProvider: boolean
  onStatusChange: (id: string, newStatus: string) => Promise<void>
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  released:  'bg-green-100 text-green-700',
  escrowed:  'bg-purple-100 text-purple-700',
  pending:   'bg-gray-100 text-gray-500',
}

export function MilestoneTracker({ milestones, isProvider, onStatusChange }: MilestoneTrackerProps) {
  const [loading, setLoading] = useState<string | null>(null)

  // Only the lowest-numbered pending milestone can be activated
  const nextPendingId = milestones.find(m => m.status === 'pending')?.id ?? null

  async function handleChange(id: string, newStatus: string) {
    setLoading(id)
    await onStatusChange(id, newStatus)
    setLoading(null)
  }

  if (!milestones.length) {
    return <p className="text-sm text-gray-400">No milestones yet.</p>
  }

  return (
    <div className="space-y-0 divide-y divide-gray-100">
      {milestones.map((m) => {
        const canActivate  = isProvider && m.status === 'pending'  && m.id === nextPendingId
        const canComplete  = isProvider && m.status === 'active'
        const isInProgress = loading === m.id

        return (
          <div key={m.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
            {/* Numbered circle */}
            <div className={`shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5 ${
              m.status === 'completed' || m.status === 'released'
                ? 'bg-green-600 text-white'
                : m.status === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-white'
            }`}>
              {m.milestone_number}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{m.title}</p>
                  {m.due_date && (
                    <p className="text-xs text-gray-500 mt-0.5">Due {m.due_date}</p>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0 mt-0.5">
                  {formatCurrency(Number(m.amount))}
                </p>
              </div>

              {/* Status badge + action */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[m.status] ?? STATUS_STYLES.pending}`}>
                  {m.status}
                </span>

                {canActivate && (
                  <button
                    onClick={() => handleChange(m.id, 'active')}
                    disabled={isInProgress}
                    className="rounded-md bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    {isInProgress ? '…' : 'Mark Active'}
                  </button>
                )}

                {canComplete && (
                  <button
                    onClick={() => handleChange(m.id, 'completed')}
                    disabled={isInProgress}
                    className="rounded-md bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    {isInProgress ? '…' : 'Mark Complete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

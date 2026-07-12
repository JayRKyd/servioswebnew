'use client'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { UKDateInput } from '@/components/shared/UKDateInput'

interface Milestone {
  id: string
  milestone_number: number
  title: string
  amount: number | string
  due_date?: string | null
  status: 'pending' | 'active' | 'completed' | 'released' | string
}

interface MilestoneEdits {
  title: string
  amount: string
  due_date: string
}

interface MilestoneTrackerProps {
  milestones: Milestone[]
  isProvider: boolean
  onStatusChange: (id: string, newStatus: string) => Promise<void>
  onEdit?: (id: string, updates: { title: string; amount: number; due_date: string | null }) => Promise<void>
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-primary/10 text-primary',
  completed: 'bg-green-100 text-green-700',
  released:  'bg-green-100 text-green-700',
  escrowed:  'bg-purple-100 text-purple-700',
  pending:   'bg-gray-100 text-gray-500',
}

export function MilestoneTracker({ milestones, isProvider, onStatusChange, onEdit }: MilestoneTrackerProps) {
  const [loading, setLoading]   = useState<string | null>(null)
  const [editing, setEditing]   = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [editForm, setEditForm] = useState<MilestoneEdits>({ title: '', amount: '', due_date: '' })

  // Only the lowest-numbered pending milestone can be activated
  const nextPendingId = milestones.find(m => m.status === 'pending')?.id ?? null
  // Only the lowest-numbered active milestone can be completed (enforces 1→2→3 order)
  const nextActiveId  = milestones.find(m => m.status === 'active')?.id ?? null

  async function handleChange(id: string, newStatus: string) {
    setLoading(id)
    await onStatusChange(id, newStatus)
    setLoading(null)
  }

  function startEdit(m: Milestone) {
    setEditing(m.id)
    setEditForm({
      title:    m.title,
      amount:   String(Number(m.amount)),
      due_date: m.due_date ?? '',
    })
  }

  async function saveEdit(id: string) {
    if (!onEdit) return
    setSaving(true)
    await onEdit(id, {
      title:    editForm.title.trim(),
      amount:   parseFloat(editForm.amount) || 0,
      due_date: editForm.due_date || null,
    })
    setSaving(false)
    setEditing(null)
  }

  if (!milestones.length) {
    return <p className="text-sm text-gray-400">No milestones yet.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {milestones.map((m) => {
        const canActivate  = isProvider && m.status === 'pending' && m.id === nextPendingId
        const canComplete  = isProvider && m.status === 'active'  && m.id === nextActiveId
        const canEdit      = isProvider && (m.status === 'pending' || m.status === 'active') && !!onEdit
        const isInProgress = loading === m.id
        const isEditing    = editing === m.id

        return (
          <div key={m.id} className="py-4 first:pt-0 last:pb-0">
            {isEditing ? (
              /* ── Inline edit form ─────────────────────────────────────── */
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold mt-1 ${
                  m.status === 'active' ? 'bg-primary text-white' : 'bg-gray-800 text-white'
                }`}>
                  {m.milestone_number}
                </div>
                <div className="flex-1 space-y-2.5">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                    <input
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Amount (£)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.amount}
                        onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Due date</label>
                      <UKDateInput
                        value={editForm.due_date}
                        onChange={v => setEditForm(f => ({ ...f, due_date: v }))}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={() => saveEdit(m.id)}
                      disabled={saving || !editForm.title.trim()}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      disabled={saving}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Read view ────────────────────────────────────────────── */
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5 ${
                  m.status === 'completed' || m.status === 'released'
                    ? 'bg-green-600 text-white'
                    : m.status === 'active'
                    ? 'bg-primary text-white'
                    : 'bg-gray-800 text-white'
                }`}>
                  {m.milestone_number}
                </div>

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

                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[m.status] ?? STATUS_STYLES.pending}`}>
                      {m.status}
                    </span>

                    {canActivate && (
                      <button
                        onClick={() => handleChange(m.id, 'active')}
                        disabled={isInProgress}
                        className="rounded-md bg-primary/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
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

                    {canEdit && (
                      <button
                        onClick={() => startEdit(m)}
                        className="rounded-md px-2.5 py-0.5 text-[11px] font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

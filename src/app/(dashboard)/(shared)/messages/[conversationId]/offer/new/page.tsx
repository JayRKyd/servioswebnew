'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { UKDateInput } from '@/components/shared/UKDateInput'

interface MilestoneRow {
  title:       string
  description: string
  amount:      string   // display value, dollars
  due_date:    string
}

const EMPTY_MILESTONE: MilestoneRow = { title: '', description: '', amount: '', due_date: '' }

export default function NewOfferPage() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const router = useRouter()

  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [milestones, setMilestones]   = useState<MilestoneRow[]>([{ ...EMPTY_MILESTONE }])
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const totalCents = milestones.reduce((sum, m) => {
    const dollars = parseFloat(m.amount)
    return sum + (isNaN(dollars) ? 0 : Math.round(dollars * 100))
  }, 0)

  function updateMilestone(i: number, field: keyof MilestoneRow, value: string) {
    setMilestones((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }

  function addMilestone() {
    setMilestones((prev) => [...prev, { ...EMPTY_MILESTONE }])
  }

  function removeMilestone(i: number) {
    setMilestones((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSend() {
    if (!title.trim()) { setError('Add a job title'); return }
    const validMilestones = milestones.filter((m) => m.title.trim() && parseFloat(m.amount) > 0)
    if (validMilestones.length === 0) { setError('Add at least one milestone with a title and amount'); return }

    setSaving(true)
    setError(null)

    const { error: err } = await apiClient(`/api/v1/conversations/${conversationId}/offers`, {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        milestones: validMilestones.map((m) => ({
          title:        m.title.trim(),
          description:  m.description.trim() || undefined,
          amount_cents: Math.round(parseFloat(m.amount) * 100),
          due_date:     m.due_date || undefined,
        })),
      }),
    })

    setSaving(false)

    if (err) { setError(err); return }
    router.push(`/messages/${conversationId}`)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-8 px-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Send an Offer</h1>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-200">{error}</div>
      )}

      {/* Job title */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">Job title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Bathroom plumbing repair"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Scope / description */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">Scope of work <span className="font-normal text-gray-400">(optional)</span></label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what's included in this offer…"
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Milestones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-gray-700">Milestones</label>
          <button onClick={addMilestone} className="text-xs font-medium text-primary hover:underline">+ Add milestone</button>
        </div>

        {milestones.map((m, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Milestone {i + 1}</span>
              {milestones.length > 1 && (
                <button onClick={() => removeMilestone(i)} className="text-xs text-red-500 hover:underline">Remove</button>
              )}
            </div>

            <input
              value={m.title}
              onChange={(e) => updateMilestone(i, 'title', e.target.value)}
              placeholder="Milestone title (e.g. Site assessment)"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">£</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={m.amount}
                  onChange={(e) => updateMilestone(i, 'amount', e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <UKDateInput
                value={m.due_date}
                onChange={(v) => updateMilestone(i, 'due_date', v)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <input
              value={m.description}
              onChange={(e) => updateMilestone(i, 'description', e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-xl bg-primary/[0.06] px-4 py-3 ring-1 ring-primary/20">
        <span className="text-sm font-semibold text-primary">Total</span>
        <span className="text-lg font-bold text-primary">{formatCurrency(totalCents / 100)}</span>
      </div>

      <button
        onClick={handleSend}
        disabled={saving}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {saving ? 'Sending…' : 'Send Offer →'}
      </button>
    </div>
  )
}

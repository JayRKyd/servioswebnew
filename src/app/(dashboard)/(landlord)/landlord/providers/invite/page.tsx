'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate } from '@/lib/utils'

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  accepted: 'bg-green-100 text-green-700',
  expired:  'bg-gray-100 text-gray-500',
}

const TRADE_OPTIONS = [
  'Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Cleaning',
  'HVAC', 'Roofing', 'Landscaping', 'Handyman', 'Gas Safe Engineer',
  'Boiler Installation & Repair', 'Flooring', 'Tiling', 'Other',
]

interface Invitation {
  id: string
  provider_name: string | null
  provider_email: string | null
  trade_type: string | null
  status: string
  invited_at: string
  accepted_at: string | null
  expires_at: string | null
  invitation_message: string | null
}

export default function InviteProviderPage() {
  const { landlordId } = useProfileIds()
  const [form, setForm] = useState({ name: '', email: '', trade: '', message: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    if (!landlordId) { setLoadingList(false); return }
    supabase
      .from('provider_invitations')
      .select('*')
      .eq('invited_by_landlord_id', landlordId)
      .order('invited_at', { ascending: false })
      .then(({ data }) => { setInvitations(data ?? []); setLoadingList(false) })
  }, [landlordId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!landlordId) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const { data: inv, error: err } = await supabase
      .from('provider_invitations')
      .insert({
        invited_by_landlord_id: landlordId,
        provider_name: form.name || null,
        provider_email: form.email,
        trade_type: form.trade || null,
        invitation_message: form.message || null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setInvitations(prev => [inv, ...prev])
    setForm({ name: '', email: '', trade: '', message: '' })
    setSuccess(true)
    setTimeout(() => setSuccess(false), 4000)
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invite a Provider</h1>
        <p className="mt-1 text-sm text-gray-500">
          Invited providers earn a reduced 10% commission rate on jobs you assign to them.
        </p>
      </div>

      {/* Invite form */}
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. James Wheeler"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="provider@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trade</label>
          <select
            value={form.trade}
            onChange={e => setForm(f => ({ ...f, trade: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select trade (optional)</option>
            {TRADE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Personal message (optional)</label>
          <textarea
            rows={3}
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            placeholder="Hi — I manage several properties in your area and would love to have you on my preferred provider list…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            Invitation sent. The provider will receive a link to join Servios with your 10% commission rate applied.
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? 'Sending…' : 'Send Invitation'}
        </button>
      </form>

      {/* Past invitations */}
      <div>
        <h2 className="mb-3 font-semibold text-gray-900">Past Invitations</h2>
        {loadingList ? (
          <div className="flex h-20 items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : invitations.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-sm text-gray-400">No invitations sent yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Trade</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invitations.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{inv.provider_name || '—'}</p>
                      <p className="text-xs text-gray-400">{inv.provider_email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.trade_type || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(inv.invited_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[inv.status] ?? 'bg-gray-100 text-gray-700'}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

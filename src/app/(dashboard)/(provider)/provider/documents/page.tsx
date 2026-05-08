'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'

const DOC_TYPES = ['insurance', 'license', 'certification', 'id', 'contract', 'other']

export default function ProviderDocumentsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ type: 'license', title: '', expiry_date: '' })

  useEffect(() => {
    if (!user) return
    supabase.from('provider_documents').select('*').eq('provider_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setDocs(data ?? []); setLoading(false) })
  }, [user?.id])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setUploading(true)
    await supabase.from('provider_documents').insert({ provider_id: user.id, document_type: form.type, title: form.title, expiry_date: form.expiry_date || null, status: 'pending' })
    setUploading(false)
    setForm({ type: 'license', title: '', expiry_date: '' })
    supabase.from('provider_documents').select('*').eq('provider_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setDocs(data ?? []))
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <h2 className="font-semibold text-gray-900">Add Document</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {DOC_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Business License 2025"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (optional)</label>
            <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <button type="submit" disabled={uploading} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
            {uploading ? 'Saving…' : 'Add Document'}
          </button>
        </form>
      </div>

      {!loading && docs.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Your Documents</h2>
          <div className="space-y-3">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{d.title}</p>
                  <p className="text-xs text-gray-400 capitalize">{d.document_type}{d.expiry_date ? ' · expires ' + formatDate(d.expiry_date) : ''}</p>
                </div>
                <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (d.status === 'verified' ? 'bg-green-100 text-green-700' : d.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700')}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

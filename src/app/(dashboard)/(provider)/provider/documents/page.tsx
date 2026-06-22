'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import { Upload, X } from 'lucide-react'

const DOC_TYPES = ['insurance', 'license', 'certification', 'id', 'contract', 'other']

const DOC_HINTS: Record<string, string> = {
  insurance: 'Public liability insurance — minimum £1m cover. Required to accept jobs.',
  license: 'Trade licence or Gas Safe / NICEIC / equivalent certification.',
  id: 'Passport or driving licence. Used for identity verification only.',
  certification: 'Any relevant trade qualification or accreditation.',
  contract: 'A signed contract or terms of service document.',
}

export default function ProviderDocumentsPage() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ type: 'license', title: '', expiry_date: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    fetchDocs()
  }, [user?.id])

  async function fetchDocs() {
    const { data } = await supabase
      .from('provider_documents')
      .select('*')
      .eq('provider_id', user!.id)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !form.title) return
    setUploading(true)
    setError(null)

    try {
      // Get the provider profile id
      const { data: profile, error: profileErr } = await supabase
        .from('provider_profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (profileErr || !profile) throw new Error('Provider profile not found')

      let file_url: string | null = null
      let storage_path: string | null = null

      // Upload file if one was selected
      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() ?? 'pdf'
        storage_path = `${user.id}/documents/${form.type}_${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('provider-documents')
          .upload(storage_path, selectedFile, { contentType: selectedFile.type })

        if (uploadErr) throw new Error(`File upload failed: ${uploadErr.message}`)

        const { data: urlData } = supabase.storage
          .from('provider-documents')
          .getPublicUrl(storage_path)

        file_url = urlData.publicUrl
      }

      const { error: insertErr } = await supabase.from('provider_documents').insert({
        provider_id: profile.id,
        document_type: form.type,
        title: form.title,
        file_url,
        storage_path,
        expiry_date: form.expiry_date || null,
        status: 'pending',
      })

      if (insertErr) throw new Error(insertErr.message)

      setForm({ type: 'license', title: '', expiry_date: '' })
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ''
      await fetchDocs()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: any) {
    if (!confirm(`Remove "${doc.title}"?`)) return

    // Remove from storage if there's a file
    if (doc.storage_path) {
      await supabase.storage.from('provider-documents').remove([doc.storage_path])
    }

    await supabase.from('provider_documents').delete().eq('id', doc.id)
    setDocs(d => d.filter(x => x.id !== doc.id))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>

      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 space-y-1">
        <p className="font-semibold">Why we verify your documents</p>
        <p>Verified providers are shown to more customers and earn a trust badge on their profile. Insurance and a valid ID are required before you can accept bookings.</p>
      </div>

      {/* Upload form */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <h2 className="font-semibold text-gray-900">Add Document</h2>
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                {DOC_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              {DOC_HINTS[form.type] && (
                <p className="mt-1 text-xs text-gray-500">{DOC_HINTS[form.type]}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Business License 2025"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File <span className="text-gray-400 font-normal">(optional — PDF or image)</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            {selectedFile ? (
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
                <span className="text-green-700 truncate">{selectedFile.name}</span>
                <button type="button" onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="ml-2 text-gray-400 hover:text-red-500 shrink-0">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors">
                <Upload size={15} /> Choose file
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={uploading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
            {uploading ? 'Uploading…' : 'Add Document'}
          </button>
        </form>
      </div>

      {/* Document list */}
      {!loading && docs.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Your Documents</h2>
          <div className="space-y-3">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{d.title}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">
                    {d.document_type}
                    {d.expiry_date ? ' · expires ' + formatDate(d.expiry_date) : ''}
                    {d.file_url ? ' · file attached' : ' · no file'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline">View</a>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    d.status === 'verified' ? 'bg-green-100 text-green-700'
                    : d.status === 'rejected' ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {d.status}
                  </span>
                  <button onClick={() => handleDelete(d)}
                    className="text-gray-300 hover:text-red-500 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && docs.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No documents added yet.</p>
      )}
    </div>
  )
}

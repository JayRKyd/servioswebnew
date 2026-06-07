'use client'
import { useRef, useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'

const DOC_TYPES = ['insurance', 'license', 'certification', 'id', 'contract', 'other']
const ACCEPTED = '.pdf,.jpg,.jpeg,.png'
const MAX_MB = 10

export default function ProviderDocumentsPage() {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [form, setForm] = useState({ type: 'license', title: '', expiry_date: '' })

  async function loadDocs() {
    if (!user) return
    const { data } = await supabase
      .from('provider_documents')
      .select('*')
      .eq('provider_id', user.id)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
  }

  useEffect(() => {
    if (!user) return
    loadDocs().then(() => setLoading(false))
  }, [user?.id])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setUploadError(null)
    if (file && file.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File must be under ${MAX_MB} MB`)
      e.target.value = ''
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
    if (file && !form.title) {
      // Pre-fill title from filename (strip extension)
      setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }))
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !selectedFile) return
    setUploading(true)
    setUploadError(null)

    const ext = selectedFile.name.split('.').pop() ?? 'bin'
    const storagePath = `${user.id}/${Date.now()}-${form.type}.${ext}`

    // Upload to Storage
    const { error: storageError } = await supabase.storage
      .from('provider-documents')
      .upload(storagePath, selectedFile, { upsert: false })

    if (storageError) {
      setUploadError(storageError.message)
      setUploading(false)
      return
    }

    // Get a signed URL (valid for 10 years ≈ permanent for our purposes)
    const { data: urlData } = await supabase.storage
      .from('provider-documents')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10)

    const fileUrl = urlData?.signedUrl ?? ''

    const { error: dbError } = await supabase.from('provider_documents').insert({
      provider_id: user.id,
      document_type: form.type,
      title: form.title,
      expiry_date: form.expiry_date || null,
      storage_path: storagePath,
      file_url: fileUrl,
      status: 'pending',
    })

    if (dbError) {
      // Clean up the uploaded file if DB insert fails
      await supabase.storage.from('provider-documents').remove([storagePath])
      setUploadError(dbError.message)
      setUploading(false)
      return
    }

    setForm({ type: 'license', title: '', expiry_date: '' })
    setSelectedFile(null)
    if (fileRef.current) fileRef.current.value = ''
    await loadDocs()
    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Documents</h1>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
        <h2 className="font-semibold text-gray-900">Add Document</h2>

        {uploadError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200">
            {uploadError}
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {DOC_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Business License 2025"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* File picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File <span className="text-gray-400 font-normal">(PDF, JPG or PNG · max {MAX_MB} MB)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 px-4 py-3 transition hover:border-primary/40 hover:bg-primary/[0.03]">
              <span className="text-xl">📎</span>
              <span className="text-sm text-gray-500">
                {selectedFile ? (
                  <span className="font-medium text-gray-800">{selectedFile.name} <span className="text-gray-400">({(selectedFile.size / 1024).toFixed(0)} KB)</span></span>
                ) : (
                  'Click to choose a file…'
                )}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED}
                onChange={handleFileChange}
                className="sr-only"
                required
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (optional)</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={uploading || !selectedFile}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        </form>
      </div>

      {!loading && docs.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-gray-900">Your Documents</h2>
          <div className="space-y-3">
            {docs.map(d => (
              <div key={d.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{d.title}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {d.document_type}
                    {d.expiry_date ? ' · expires ' + formatDate(d.expiry_date) : ''}
                  </p>
                  {d.rejection_reason && (
                    <p className="mt-0.5 text-xs text-red-500">{d.rejection_reason}</p>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  {d.file_url && (
                    <a
                      href={d.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View ↗
                    </a>
                  )}
                  <span className={
                    'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' +
                    (d.status === 'verified' ? 'bg-green-100 text-green-700' :
                     d.status === 'rejected' ? 'bg-red-100 text-red-700' :
                     'bg-yellow-100 text-yellow-700')
                  }>
                    {d.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

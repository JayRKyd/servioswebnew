'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import {
  Shield, Award, CreditCard, BadgeCheck, FileText, File,
  Upload, X, AlertTriangle, CheckCircle2, Clock, ChevronRight,
  Eye,
} from 'lucide-react'

const DOC_TYPES = ['insurance', 'license', 'certification', 'id', 'contract', 'other']

const DOC_META: Record<string, { label: string; icon: React.ReactNode; hint: string; color: string }> = {
  insurance: {
    label: 'Insurance',
    icon: <Shield size={16} />,
    hint: 'Public liability insurance — minimum £1m cover. Required to accept jobs.',
    color: 'text-blue-600 bg-blue-50',
  },
  license: {
    label: 'License',
    icon: <Award size={16} />,
    hint: 'Trade licence or Gas Safe / NICEIC / equivalent certification.',
    color: 'text-purple-600 bg-purple-50',
  },
  certification: {
    label: 'Certification',
    icon: <BadgeCheck size={16} />,
    hint: 'Any relevant trade qualification or accreditation.',
    color: 'text-indigo-600 bg-indigo-50',
  },
  id: {
    label: 'ID',
    icon: <CreditCard size={16} />,
    hint: 'Passport or driving licence. Used for identity verification only.',
    color: 'text-teal-600 bg-teal-50',
  },
  contract: {
    label: 'Contract',
    icon: <FileText size={16} />,
    hint: 'A signed contract or terms of service document.',
    color: 'text-orange-600 bg-orange-50',
  },
  other: {
    label: 'Other',
    icon: <File size={16} />,
    hint: 'Any other supporting document.',
    color: 'text-gray-600 bg-gray-100',
  },
}

const REQUIRED_TYPES = ['insurance', 'id', 'license'] as const

function expiryStatus(expiry: string | null): 'expired' | 'soon' | 'ok' | null {
  if (!expiry) return null
  const diff = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'soon'
  return 'ok'
}

export default function ProviderDocumentsPage() {
  const { user } = useAuth()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({ type: 'license', title: '', expiry_date: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('id').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.id) {
          setProfileId(data.id)
          fetchDocs(data.id)
        } else {
          setLoading(false)
        }
      })
  }, [user?.id])

  async function fetchDocs(pid: string) {
    const { data } = await supabase
      .from('provider_documents')
      .select('*')
      .eq('provider_id', pid)
      .order('created_at', { ascending: false })
    setDocs(data ?? [])
    setLoading(false)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !form.title || !profileId) return
    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const profile = { id: profileId }

      let file_url: string | null = null
      let storage_path: string | null = null

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop() ?? 'pdf'
        storage_path = `${user.id}/documents/${form.type}_${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('provider-documents')
          .upload(storage_path, selectedFile, { contentType: selectedFile.type })
        if (upErr) throw new Error(`File upload failed: ${upErr.message}`)
        const { data: urlData } = supabase.storage.from('provider-documents').getPublicUrl(storage_path)
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
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await fetchDocs(profileId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: any) {
    if (!confirm(`Remove "${doc.title}"?`)) return
    if (doc.storage_path) await supabase.storage.from('provider-documents').remove([doc.storage_path])
    await supabase.from('provider_documents').delete().eq('id', doc.id)
    setDocs(d => d.filter(x => x.id !== doc.id))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) setSelectedFile(file)
  }

  // Verification status per required type
  const verifiedCount = REQUIRED_TYPES.filter(t =>
    docs.some(d => d.document_type === t && d.status === 'verified')
  ).length

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-0.5 text-sm text-gray-400">Upload your credentials to get verified and unlock more bookings</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          verifiedCount === REQUIRED_TYPES.length
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {verifiedCount}/{REQUIRED_TYPES.length} required verified
        </span>
      </div>

      {/* ── Required documents checklist ── */}
      <div className="grid grid-cols-3 gap-3">
        {REQUIRED_TYPES.map(type => {
          const meta = DOC_META[type]
          const submitted = docs.find(d => d.document_type === type)
          const status = submitted?.status ?? null
          return (
            <div key={type} className={`rounded-2xl border p-4 ${
              status === 'verified'
                ? 'border-green-200 bg-green-50'
                : submitted
                ? 'border-amber-200 bg-amber-50'
                : 'border-gray-100 bg-white'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className={`rounded-xl p-2 ${meta.color}`}>{meta.icon}</div>
                {status === 'verified'
                  ? <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                  : submitted
                  ? <Clock size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  : <div className="h-4 w-4 rounded-full border-2 border-gray-200 mt-0.5 shrink-0" />}
              </div>
              <p className="mt-3 text-sm font-semibold text-gray-900">{meta.label}</p>
              <p className={`mt-0.5 text-xs font-medium capitalize ${
                status === 'verified' ? 'text-green-600'
                : submitted ? 'text-amber-600'
                : 'text-gray-400'
              }`}>
                {status === 'verified' ? 'Verified' : submitted ? `${submitted.status} review` : 'Not submitted'}
              </p>
            </div>
          )
        })}
      </div>

      {/* ── Two-column: form + list ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">

        {/* Upload form */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 h-fit">
          <h2 className="mb-5 text-sm font-bold text-gray-900 uppercase tracking-wider">Add Document</h2>
          <form onSubmit={handleUpload} className="space-y-4">

            {/* Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {DOC_TYPES.map(t => (
                  <option key={t} value={t}>{DOC_META[t]?.label ?? t}</option>
                ))}
              </select>
              {DOC_META[form.type]?.hint && (
                <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">{DOC_META[form.type].hint}</p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Public Liability Insurance 2025"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Expiry */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Expiry Date <span className="normal-case font-normal text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* File drop zone */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                File <span className="normal-case font-normal text-gray-400">(optional — PDF or image)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              {selectedFile ? (
                <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-green-600 shrink-0" />
                    <span className="text-sm text-green-800 font-medium truncate">{selectedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="ml-2 shrink-0 text-green-400 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                    dragging
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-400 hover:border-primary hover:text-primary'
                  }`}
                >
                  <Upload size={20} />
                  <div>
                    <p className="text-sm font-medium">Drop file here or click to browse</p>
                    <p className="text-xs text-gray-300 mt-0.5">PDF, JPG, PNG up to 10MB</p>
                  </div>
                </button>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertTriangle size={14} className="shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle2 size={14} className="shrink-0" /> Document submitted for review.
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {uploading ? 'Uploading…' : 'Submit Document'}
            </button>
          </form>
        </div>

        {/* Document list */}
        <div>
          <h2 className="mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Your Documents</h2>

          {loading ? (
            <div className="flex h-32 items-center justify-center rounded-2xl bg-white ring-1 ring-gray-100">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200">
              <div className="rounded-2xl bg-gray-50 p-4">
                <FileText size={28} className="text-gray-300" />
              </div>
              <p className="text-sm text-gray-400">No documents submitted yet</p>
              <p className="text-xs text-gray-300">Use the form to add your first document</p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map(d => {
                const meta = DOC_META[d.document_type] ?? DOC_META.other
                const expiry = expiryStatus(d.expiry_date)
                const isExpired = expiry === 'expired'
                const expiringSoon = expiry === 'soon'

                return (
                  <div
                    key={d.id}
                    className={`flex items-start gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 transition-all ${
                      isExpired ? 'ring-red-200' : 'ring-gray-100'
                    }`}
                  >
                    {/* Type icon */}
                    <div className={`rounded-xl p-2.5 shrink-0 ${meta.color}`}>
                      {meta.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900 truncate">{d.title}</p>
                        {/* Status badge */}
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          d.status === 'verified'
                            ? 'bg-green-100 text-green-700'
                            : d.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {d.status === 'pending' ? 'In review' : d.status}
                        </span>
                      </div>

                      <p className="mt-0.5 text-xs text-gray-400 capitalize">{meta.label}</p>

                      {/* Expiry */}
                      {d.expiry_date && (
                        <p className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${
                          isExpired ? 'text-red-600' : expiringSoon ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          {(isExpired || expiringSoon) && <AlertTriangle size={10} />}
                          {isExpired ? 'Expired ' : expiringSoon ? 'Expires ' : 'Expires '}
                          {formatDate(d.expiry_date)}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="mt-2 flex items-center gap-3">
                        {d.file_url && (
                          <a
                            href={d.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <Eye size={11} /> View file
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(d)}
                          className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

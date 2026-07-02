'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import { UKDateInput } from '@/components/shared/UKDateInput'
import {
  Shield, Award, CreditCard, BadgeCheck, FileText, File,
  Upload, X, AlertTriangle, CheckCircle2, Clock, Lock,
  Eye, ImageIcon,
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

// What to upload, examples, and what each doc unlocks
const DOC_GUIDE: Record<string, {
  examples: string[]
  accepts: string
  unlocks: string
}> = {
  insurance: {
    examples: ['Public Liability Certificate', 'Employer\'s Liability Policy', 'Professional Indemnity Certificate'],
    accepts: 'Certificate PDF or photo of your policy schedule',
    unlocks: 'Required to accept any paid booking on Servios',
  },
  license: {
    examples: ['Gas Safe Certificate', 'NICEIC Registration Card', 'Trade Licence', 'CORGI Certificate'],
    accepts: 'Clear photo or scan of your registration card or certificate',
    unlocks: 'Displays your trade badge on your public profile',
  },
  id: {
    examples: ['UK Passport (photo page)', 'UK Driving Licence (front)', 'National Identity Card'],
    accepts: 'Clear colour photo — all four corners visible, no glare',
    unlocks: 'Required for identity verification and fraud prevention',
  },
  certification: {
    examples: ['NVQ / City & Guilds Certificate', 'CSCS Card', 'CHAS Accreditation', 'Safe Contractor'],
    accepts: 'Photo or PDF of your qualification or accreditation certificate',
    unlocks: 'Shown as a credential on your profile to build customer trust',
  },
  contract: {
    examples: ['Signed Terms of Service', 'Subcontractor Agreement', 'Client Contract Template'],
    accepts: 'Signed PDF or scanned copy',
    unlocks: 'Stored for reference — may be required for some landlord jobs',
  },
  other: {
    examples: ['DBS Check Certificate', 'Training Record', 'Award or Commendation'],
    accepts: 'PDF, JPG, or PNG — any relevant supporting document',
    unlocks: 'Adds supporting evidence to your verified provider profile',
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
            : verifiedCount === 0
            ? 'bg-red-100 text-red-700'
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

            {/* What this document unlocks */}
            {DOC_GUIDE[form.type] && (
              <div className="rounded-xl border border-primary/10 bg-primary/[0.04] p-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-[11px] w-[11px] shrink-0" />
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">What this unlocks</p>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{DOC_GUIDE[form.type].unlocks}</p>
                <div className="pt-1 border-t border-primary/10">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Accepted examples</p>
                  <ul className="space-y-0.5">
                    {DOC_GUIDE[form.type].examples.map(ex => (
                      <li key={ex} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="h-1 w-1 rounded-full bg-gray-300 shrink-0" />
                        {ex}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

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
              <UKDateInput
                value={form.expiry_date}
                onChange={v => setForm(f => ({ ...f, expiry_date: v }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* File drop zone */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                File <span className="normal-case font-normal text-gray-400">(optional)</span>
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
                  className={`group relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-xl border-2 border-dashed px-4 py-7 text-center transition-all ${
                    dragging
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50/60'
                  }`}
                >
                  {/* Upload icon */}
                  <div className={`rounded-2xl p-3 transition-colors ${dragging ? 'bg-primary/10' : 'bg-gray-100 group-hover:bg-primary/10'}`}>
                    <Upload size={20} className={`transition-colors ${dragging ? 'text-primary' : 'text-gray-400 group-hover:text-primary'}`} />
                  </div>

                  <div>
                    <p className={`text-sm font-semibold transition-colors ${dragging ? 'text-primary' : 'text-gray-600 group-hover:text-gray-900'}`}>
                      {dragging ? 'Drop to upload' : 'Drag & drop or click to browse'}
                    </p>
                    {DOC_GUIDE[form.type] && (
                      <p className="mt-0.5 text-xs text-gray-400 leading-relaxed px-2">
                        {DOC_GUIDE[form.type].accepts}
                      </p>
                    )}
                  </div>

                  {/* Accepted format chips */}
                  <div className="flex items-center gap-2">
                    {[
                      { label: 'PDF', icon: <FileText size={10} /> },
                      { label: 'JPG', icon: <ImageIcon size={10} /> },
                      { label: 'PNG', icon: <ImageIcon size={10} /> },
                    ].map(f => (
                      <span key={f.label} className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                        {f.icon} {f.label}
                      </span>
                    ))}
                    <span className="text-[10px] text-gray-300">· max 10 MB</span>
                  </div>
                </button>
              )}
            </div>

            {/* Security note */}
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <Lock size={11} className="text-gray-400 shrink-0" />
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Encrypted and stored securely. Reviewed only by Servios staff — never shared with customers.
              </p>
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

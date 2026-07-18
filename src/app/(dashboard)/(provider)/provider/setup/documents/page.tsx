'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { UKDateInput } from '@/components/shared/UKDateInput'
import { Check } from 'lucide-react'
import { invalidateOnboardingCache } from '@/components/providers/OnboardingProvider'

const DOC_TYPES = [
  { value: 'id',            label: 'Government ID',       required: true },
  { value: 'insurance',     label: 'Liability Insurance', required: true },
  { value: 'certification', label: 'Trade Certification', required: false },
  { value: 'license',       label: 'Business License',    required: false },
]

interface UploadedDoc { type: string; fileName: string; url: string }

export default function SetupDocumentsPage() {
  const router = useRouter()
  const [uploads, setUploads] = useState<UploadedDoc[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [expiry, setExpiry] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const uploadedTypes = new Set(uploads.map((u) => u.type))
  const requiredDone = DOC_TYPES.filter((d) => d.required).every((d) => uploadedTypes.has(d.value))

  async function handleFile(docType: string, docLabel: string, file: File) {
    setUploading(docType)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const ext = file.name.split('.').pop() ?? 'pdf'
      const storagePath = `${session.user.id}/onboarding/${docType}_${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('provider-documents')
        .upload(storagePath, file, { contentType: file.type })

      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('provider-documents').getPublicUrl(storagePath)

      const { data: profile } = await supabase.from('provider_profiles').select('id').eq('user_id', session.user.id).single()

      await supabase.from('provider_documents').insert({
        provider_id: profile!.id,
        document_type: docType,
        title: docLabel,
        file_url: urlData.publicUrl,
        storage_path: storagePath,
        expiry_date: expiry[docType] || null,
        status: 'pending',
      })

      setUploads((prev) => [
        ...prev.filter((u) => u.type !== docType),
        { type: docType, fileName: file.name, url: urlData.publicUrl },
      ])
    } catch (e: any) {
      alert(`Upload failed: ${e.message}`)
    } finally {
      setUploading(null)
    }
  }

  async function handleSubmit() {
    if (!requiredDone) return
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('provider_profiles').update({ onboarding_complete: true, onboarding_step: 'complete', verification_status: 'pending' }).eq('user_id', user!.id)
    invalidateOnboardingCache()
    router.push('/provider/setup/complete')
    setSubmitting(false)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10">
      {/* Progress */}
      <div className="flex items-center gap-2">
        {['Trade', 'Services', 'Documents'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i <= 2 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i < 2 ? <Check size={13} strokeWidth={3} /> : 3}
            </div>
            <span className={`text-sm ${i === 2 ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{label}</span>
            {i < 2 && <div className="mx-1 h-px w-8 bg-gray-200" />}
          </div>
        ))}
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload documents</h1>
        <p className="mt-1 text-gray-500">Items marked * are required before you can go live</p>
      </div>

      <div className="space-y-4">
        {DOC_TYPES.map((doc) => {
          const uploaded = uploads.find((u) => u.type === doc.value)
          const isUploading = uploading === doc.value
          return (
            <div key={doc.value} className={`rounded-xl border-2 bg-white p-5 space-y-3 ${uploaded ? 'border-green-300' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{doc.label}{doc.required ? ' *' : ''}</p>
                  {uploaded && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{uploaded.fileName}</p>}
                </div>
                {uploaded && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">
                    <Check size={11} strokeWidth={3} /> Uploaded
                  </span>
                )}
              </div>

              {!uploaded && (
                <UKDateInput value={expiry[doc.value] ?? ''} onChange={(v) => setExpiry((prev) => ({ ...prev, [doc.value]: v }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Expiry date (optional)" />
              )}

              <input
                ref={(el) => { fileRefs.current[doc.value] = el }}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(doc.value, doc.label, file)
                }}
              />
              <button
                onClick={() => fileRefs.current[doc.value]?.click()}
                disabled={isUploading}
                className={`w-full rounded-lg py-2 text-sm font-medium disabled:opacity-50 ${
                  uploaded ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-primary text-white hover:bg-primary-dark'
                }`}
              >
                {isUploading ? 'Uploading…' : uploaded ? '↩ Replace' : '📎 Upload'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl bg-green-50 p-4 text-sm text-green-700">
        🔒 Documents are stored securely and only reviewed by our verification team.
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!requiredDone || submitting}
          className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Submit for Verification →'}
        </button>
      </div>
    </div>
  )
}

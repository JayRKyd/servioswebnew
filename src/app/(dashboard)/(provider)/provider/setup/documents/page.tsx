'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { UKDateInput } from '@/components/shared/UKDateInput'
import { Check, Camera, Upload, Lock } from 'lucide-react'
import { setOnboardingStatus } from '@/components/providers/OnboardingProvider'
import { SetupProgress } from '@/components/provider/SetupProgress'

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

  // Profile photo is gated exactly like the required documents (design item
  // 24) — Airbnb/TaskRabbit/Upwork all require one before a profile goes live
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('provider_profiles').select('profile_image_url').eq('user_id', user.id).maybeSingle()
      if (profile?.profile_image_url) setPhotoUrl(profile.profile_image_url)
    })
  }, [])

  async function handlePhoto(file: File) {
    setPhotoUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('provider_profiles').update({ profile_image_url: publicUrl }).eq('user_id', user.id)
      setPhotoUrl(publicUrl)
    } catch (e: any) {
      alert(`Photo upload failed: ${e.message}`)
    } finally {
      setPhotoUploading(false)
    }
  }

  const uploadedTypes = new Set(uploads.map((u) => u.type))
  const requiredDone = !!photoUrl && DOC_TYPES.filter((d) => d.required).every((d) => uploadedTypes.has(d.value))

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
    // Update the mounted provider too — nulling the cache alone left stale
    // complete:false state, bouncing "View My Dashboard" back to step 1
    setOnboardingStatus(user!.id, { complete: true, step: 'complete' })
    router.push('/provider/setup/complete')
    setSubmitting(false)
  }

  return (
    <div className="space-y-6 pb-10">
      <SetupProgress current={3} />

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Photo &amp; documents</h1>
        <p className="mt-1 text-gray-500">Items marked * are required before you can go live</p>
      </div>

      {/* Profile photo — required, like every marketplace worth trusting */}
      <div className={`rounded-xl border-2 bg-white p-5 ${photoUrl ? 'border-green-300' : 'border-gray-100'}`}>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100">
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300">
                <Camera size={22} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-gray-900">Profile photo *</p>
              {photoUrl && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">
                  <Check size={11} strokeWidth={3} /> Added
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              A clear photo of you — or your logo plus a photo if you&apos;re a company.
              Customers book people they can see.
            </p>
          </div>
        </div>
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f) }}
        />
        <button
          onClick={() => photoRef.current?.click()}
          disabled={photoUploading}
          className={`mt-3 w-full rounded-lg py-2 text-sm font-medium disabled:opacity-50 ${
            photoUrl ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-primary text-white hover:bg-primary-dark'
          }`}
        >
          {photoUploading ? 'Uploading…' : photoUrl ? 'Replace photo' : 'Add photo'}
        </button>
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
                {isUploading ? 'Uploading…' : uploaded ? 'Replace' : (
                  <span className="inline-flex items-center gap-1.5"><Upload size={13} /> Upload</span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-green-700">
        <Lock size={14} className="shrink-0" />
        Documents are stored securely and only reviewed by our verification team.
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

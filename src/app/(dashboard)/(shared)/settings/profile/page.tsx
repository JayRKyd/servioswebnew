'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useActiveRole } from '@/hooks/useActiveRole'
import { Camera } from 'lucide-react'

export default function EditProfilePage() {
  const { user } = useAuth()
  const { activeRole } = useActiveRole()
  const router = useRouter()
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  const table = activeRole === 'customer' ? 'customer_profiles'
    : activeRole === 'provider' ? 'provider_profiles'
    : activeRole === 'landlord' ? 'landlord_profiles'
    : 'tenant_profiles'

  useEffect(() => {
    if (!user) return
    supabase.from(table).select('first_name, last_name, phone, profile_image_url').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setForm({ first_name: data.first_name ?? '', last_name: data.last_name ?? '', phone: data.phone ?? '' })
          setAvatarUrl(data.profile_image_url ?? null)
        }
      })
  }, [user?.id, table])

  async function uploadAvatar(file: File) {
    if (!user) return
    setAvatarUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from(table).update({ profile_image_url: publicUrl }).eq('user_id', user.id)
      setAvatarUrl(publicUrl)
    }
    setAvatarUploading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from(table).update({ first_name: form.first_name, last_name: form.last_name, phone: form.phone }).eq('user_id', user.id)
    if (error) { setError(error.message); setSaving(false); return }
    setSuccess(true)
    setSaving(false)
    setTimeout(() => router.push('/settings'), 1500)
  }

  const initials = `${form.first_name?.[0] ?? ''}${form.last_name?.[0] ?? ''}`.toUpperCase() || '?'

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="relative shrink-0 group/av">
          <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold overflow-hidden ring-2 ring-gray-100">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              : initials}
          </div>
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            disabled={avatarUploading}
            className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity disabled:cursor-wait"
            title="Change photo"
          >
            {avatarUploading
              ? <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <Camera size={16} className="text-white" />}
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = '' }}
          />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{form.first_name} {form.last_name}</p>
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            disabled={avatarUploading}
            className="mt-0.5 text-xs text-primary hover:underline disabled:opacity-50"
          >
            {avatarUploading ? 'Uploading…' : 'Change photo'}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">First Name</label><input required value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label><input required value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
        </div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Profile updated!</p>}
        <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">{saving ? 'Saving…' : 'Save Changes'}</button>
      </form>
    </div>
  )
}

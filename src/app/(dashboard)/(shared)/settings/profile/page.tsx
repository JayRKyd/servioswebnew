'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { useActiveRole } from '@/hooks/useActiveRole'

export default function EditProfilePage() {
  const { user } = useAuth()
  const { activeRole } = useActiveRole()
  const router = useRouter()
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const table = activeRole === 'customer' ? 'customer_profiles' : activeRole === 'provider' ? 'provider_profiles' : activeRole === 'landlord' ? 'landlord_profiles' : 'tenant_profiles'

  useEffect(() => {
    if (!user) return
    supabase.from(table).select('first_name, last_name, phone').eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setForm({ first_name: data.first_name ?? '', last_name: data.last_name ?? '', phone: data.phone ?? '' }) })
  }, [user?.id, table])

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

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
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

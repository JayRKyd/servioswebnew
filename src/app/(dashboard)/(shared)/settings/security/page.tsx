'use client'
import { useState } from 'react'
import { supabase } from '@/lib/auth'

export default function SecurityPage() {
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSaving(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: form.password })
    if (error) { setError(error.message); setSaving(false); return }
    setSuccess(true)
    setForm({ password: '', confirm: '' })
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Security</h1>
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
        {success ? (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">Password updated successfully.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">New Password</label><input type="password" required value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label><input type="password" required value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">{saving ? 'Saving…' : 'Update Password'}</button>
          </form>
        )}
      </div>
    </div>
  )
}

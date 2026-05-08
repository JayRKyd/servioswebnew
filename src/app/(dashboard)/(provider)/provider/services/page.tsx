'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export default function ProviderServicesPage() {
  const { user } = useAuth()
  const [offerings, setOfferings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('provider_profiles').select('id').eq('user_id', user.id).maybeSingle()
      .then(async ({ data: profile }) => {
        if (!profile) { setLoading(false); return }
        const { data } = await supabase
          .from('provider_services')
          .select('*, services(title, service_categories(name))')
          .eq('provider_id', profile.id)
          .order('created_at', { ascending: false })
        setOfferings(data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user?.id])

  async function toggle(id: string, current: boolean) {
    await supabase.from('provider_services').update({ is_active: !current }).eq('id', id)
    setOfferings(o => o.map(s => s.id === id ? { ...s, is_active: !current } : s))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Services</h1>
        <Link href="/provider/services/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">+ Add Service</Link>
      </div>

      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        offerings.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-center">
            <div><p className="text-gray-400">No services yet</p><Link href="/provider/services/new" className="mt-2 block text-sm text-primary hover:underline">Add your first service</Link></div>
          </div>
        ) : (
          <div className="space-y-3">
            {offerings.map(o => (
              <div key={o.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div>
                  <p className="font-semibold text-gray-900">{o.services?.title}</p>
                  <p className="text-xs text-gray-400">{o.services?.service_categories?.name} · USD {o.custom_price ?? '—'}/{o.price_type}</p>
                  {o.duration_minutes && <p className="text-xs text-gray-400">{o.duration_minutes} min</p>}
                </div>
                <button onClick={() => toggle(o.id, o.is_active)}
                  className={'rounded-full px-3 py-1 text-xs font-medium transition ' + (o.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                  {o.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

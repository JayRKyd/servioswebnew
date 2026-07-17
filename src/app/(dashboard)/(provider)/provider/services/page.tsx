'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { Briefcase } from 'lucide-react'

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

  function priceLabel(o: any) {
    if (o.price_type === 'quote' || o.custom_price == null) return 'Price on request'
    return o.price_type === 'hourly' ? `£${o.custom_price}/hr` : `£${o.custom_price} fixed`
  }

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
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Briefcase size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">List your services</p>
              <p className="mt-1 text-sm text-gray-500 max-w-xs mx-auto">Add the services you offer and set your prices. Customers searching for your trade will be able to book you directly.</p>
            </div>
            <Link href="/provider/services/new" className="inline-block rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Add your first service
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {offerings.map(o => (
              <div key={o.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div>
                  <p className="font-semibold text-gray-900">{o.services?.title}</p>
                  <p className="text-xs text-gray-400">{[o.services?.service_categories?.name, priceLabel(o), o.duration_minutes ? `${o.duration_minutes} min` : null].filter(Boolean).join(' · ')}</p>
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

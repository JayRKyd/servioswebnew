'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { titleCase } from '@/lib/utils'

export default function ServiceDetailPage() {
  const { id } = useParams()
  const [service, setService] = useState<any>(null)
  const [offerings, setOfferings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('services').select('*').eq('id', id).single(),
      supabase.from('provider_services').select('*, provider_profiles(first_name, last_name, business_name, rating_average, rating_count)').eq('service_id', id).eq('is_active', true),
    ]).then(([{ data: svc }, { data: offs }]) => {
      setService(svc)
      setOfferings(offs ?? [])
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!service) return <div className="text-gray-400">Service not found.</div>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-primary">{service.category}</span>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{service.title}</h1>
        {service.description && <p className="mt-2 text-gray-500">{service.description}</p>}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Available Providers</h2>
        {offerings.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">No providers available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {offerings.map(o => {
              const p = o.provider_profiles
              return (
                <div key={o.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                  <div>
                    <p className="font-semibold text-gray-900">{p?.business_name}</p>
                    <p className="text-sm text-gray-500">{titleCase(p?.first_name ?? '')} {titleCase(p?.last_name ?? '')}</p>
                    {p?.rating_average > 0 && (
                      <p className="mt-0.5 text-xs text-yellow-500">{'★'.repeat(Math.round(p.rating_average))} ({p.rating_count})</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {o.base_price && <span className="text-sm font-medium text-primary">£{o.base_price}/{o.price_type}</span>}
                    <Link href={'/bookings/new?service=' + service.id + '&provider=' + o.provider_id}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark">
                      Book
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

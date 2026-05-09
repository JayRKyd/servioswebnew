'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'

export default function LandlordPropertiesPage() {
  const { landlordId } = useProfileIds()
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!landlordId) return
    supabase.from('properties').select('*').eq('landlord_id', landlordId).order('created_at', { ascending: false })
      .then(({ data }) => { setProperties(data ?? []); setLoading(false) })
  }, [landlordId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
        <Link href="/landlord/properties/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">+ Add Property</Link>
      </div>

      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        properties.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-center">
            <div><p className="text-gray-400">No properties yet</p><Link href="/landlord/properties/new" className="mt-2 block text-sm text-primary hover:underline">Add your first property</Link></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map(p => (
              <Link key={p.id} href={'/landlord/properties/' + p.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{p.name}</p>
                    <p className="text-sm text-gray-500">{p.address?.street}, {p.address?.island}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">{p.property_type?.replace('_', ' ')}</span>
                </div>
                {(p.bedrooms || p.bathrooms) && (
                  <p className="mt-2 text-xs text-gray-400">{p.bedrooms ? p.bedrooms + ' bed' : ''}{p.bedrooms && p.bathrooms ? ' · ' : ''}{p.bathrooms ? p.bathrooms + ' bath' : ''}</p>
                )}
              </Link>
            ))}
          </div>
        )
      }
    </div>
  )
}

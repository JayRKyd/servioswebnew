'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

export default function TenantJoinPage() {
  return <Suspense fallback={null}><TenantJoinInner /></Suspense>
}
function TenantJoinInner() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const propertyId = searchParams.get('property')
  const [property, setProperty] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!propertyId) { setLoading(false); return }
    supabase.from('properties').select('id, name, address, property_type').eq('id', propertyId).single()
      .then(({ data }) => { setProperty(data); setLoading(false) })
  }, [propertyId])

  async function handleJoin() {
    if (!user || !propertyId) return
    setJoining(true)
    setError(null)
    try {
      // Update tenant profile with this property
      const { error: err } = await supabase
        .from('tenant_profiles')
        .update({ property_id: propertyId })
        .eq('user_id', user.id)
      if (err) throw err
      setJoined(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>

  if (!propertyId || !property) {
    return (
      <div className="mx-auto max-w-md text-center py-20 space-y-4">
        <p className="text-4xl">❌</p>
        <h1 className="text-xl font-bold text-gray-900">Invalid QR Code</h1>
        <p className="text-gray-500">This property link is not valid.</p>
        <button onClick={() => router.push('/tenant')} className="text-sm text-primary hover:underline">Go to dashboard</button>
      </div>
    )
  }

  if (joined) {
    return (
      <div className="mx-auto max-w-md text-center py-20 space-y-4">
        <p className="text-5xl">🎉</p>
        <h1 className="text-xl font-bold text-gray-900">You're linked!</h1>
        <p className="text-gray-500">You've been linked to <strong>{property.name}</strong>.</p>
        <button onClick={() => router.push('/tenant')} className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-white hover:bg-primary-dark">
          Go to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md py-16 space-y-6">
      <div className="text-center space-y-2">
        <p className="text-4xl">🏠</p>
        <h1 className="text-2xl font-bold text-gray-900">Join Property</h1>
        <p className="text-gray-500">You've been invited to link your account to this property.</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-3">
        <p className="text-lg font-bold text-gray-900">{property.name}</p>
        {property.address?.street && (
          <p className="text-sm text-gray-500">{property.address.street}, {property.address.island}</p>
        )}
        <p className="text-xs text-gray-400 capitalize">{property.property_type?.replace('_', ' ')}</p>
      </div>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <button
        onClick={handleJoin}
        disabled={joining}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {joining ? 'Linking…' : 'Link My Account to This Property'}
      </button>

      <button onClick={() => router.push('/tenant')} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">
        Cancel
      </button>
    </div>
  )
}

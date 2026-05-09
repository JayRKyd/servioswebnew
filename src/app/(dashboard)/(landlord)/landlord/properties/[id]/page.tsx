'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/auth'

type Tab = 'overview' | 'tenants' | 'maintenance' | 'compliance' | 'qr'

function QRCodePanel({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/tenant/join?property=${propertyId}`
    : `https://app.servios.com/tenant/join?property=${propertyId}`

  useEffect(() => {
    import('qrcode').then((QRCode) => {
      QRCode.default.toDataURL(joinUrl, { width: 280, margin: 2, color: { dark: '#111827', light: '#ffffff' } })
        .then(setQrDataUrl)
    })
  }, [joinUrl])

  function handleDownload() {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `${propertyName.replace(/\s+/g, '-')}-qr.png`
    a.click()
  }

  function handleCopy() {
    navigator.clipboard.writeText(joinUrl)
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Property QR Code</h2>
        <p className="text-sm text-gray-500 mt-1">
          Share this code with tenants so they can scan and link their account to this property.
        </p>
      </div>

      <div className="flex justify-center">
        {qrDataUrl ? (
          <div className="rounded-2xl border-2 border-gray-100 p-4 bg-white shadow-inner">
            <img src={qrDataUrl} alt="Property QR code" className="w-56 h-56" />
          </div>
        ) : (
          <div className="flex h-56 w-56 items-center justify-center rounded-2xl border-2 border-gray-100 bg-gray-50">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs text-gray-400 mb-1">Join link</p>
        <p className="text-sm text-gray-700 break-all font-mono">{joinUrl}</p>
      </div>

      <div className="flex gap-3">
        <button onClick={handleCopy}
          className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          📋 Copy Link
        </button>
        <button onClick={handleDownload} disabled={!qrDataUrl}
          className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50">
          ⬇ Download QR
        </button>
      </div>
    </div>
  )
}

export default function PropertyDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [property, setProperty] = useState<any>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    Promise.all([
      supabase.from('properties').select('*').eq('id', id).single(),
      supabase.from('tenants').select('*').eq('property_id', id).eq('is_active', true),
    ]).then(([{ data: p }, { data: t }]) => { setProperty(p); setTenants(t ?? []); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!property) return <div className="text-gray-400">Property not found.</div>

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tenants', label: 'Tenants' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'qr', label: 'QR Code' },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-primary hover:underline">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">{property.name}</h1>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={'pb-2 px-1 text-sm font-medium whitespace-nowrap transition border-b-2 ' +
              (tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-gray-400">Type</p><p className="font-medium capitalize">{property.property_type?.replace('_', ' ')}</p></div>
            <div><p className="text-xs text-gray-400">Island</p><p className="font-medium">{property.address?.island}</p></div>
            <div><p className="text-xs text-gray-400">Address</p><p className="font-medium">{property.address?.street}</p></div>
            {property.bedrooms && <div><p className="text-xs text-gray-400">Bedrooms</p><p className="font-medium">{property.bedrooms}</p></div>}
            {property.bathrooms && <div><p className="text-xs text-gray-400">Bathrooms</p><p className="font-medium">{property.bathrooms}</p></div>}
            {property.square_feet && <div><p className="text-xs text-gray-400">Size</p><p className="font-medium">{property.square_feet} sq ft</p></div>}
          </div>
          {property.notes && <div className="border-t pt-4"><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-700">{property.notes}</p></div>}
          <div className="border-t pt-4 flex gap-3 flex-wrap">
            <Link href={'/landlord/properties/' + id + '/maintenance'} className="flex-1 min-w-[120px] rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">Maintenance</Link>
            <Link href={'/landlord/properties/' + id + '/compliance'} className="flex-1 min-w-[120px] rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">Compliance</Link>
            <Link href={'/landlord/properties/' + id + '/history'} className="flex-1 min-w-[120px] rounded-lg border border-gray-200 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50">History</Link>
          </div>
        </div>
      )}

      {tab === 'tenants' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link href={'/landlord/tenants/new?property=' + id} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark">+ Add Tenant</Link>
          </div>
          {tenants.length === 0
            ? <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-gray-200"><p className="text-gray-400">No tenants</p></div>
            : tenants.map(t => (
              <Link key={t.id} href={'/landlord/tenants/' + t.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">
                <div>
                  <p className="font-medium text-gray-900">{t.first_name} {t.last_name}</p>
                  <p className="text-sm text-gray-500">{t.email ?? t.phone}</p>
                </div>
                <span className="text-sm text-gray-400">Unit {t.unit_number ?? '—'}</span>
              </Link>
            ))
          }
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="text-center py-10">
          <Link href={'/landlord/properties/' + id + '/maintenance'} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
            View Maintenance Requests →
          </Link>
        </div>
      )}

      {tab === 'compliance' && (
        <div className="text-center py-10">
          <Link href={'/landlord/properties/' + id + '/compliance'} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark">
            View Compliance →
          </Link>
        </div>
      )}

      {tab === 'qr' && (
        <QRCodePanel propertyId={id as string} propertyName={property.name} />
      )}
    </div>
  )
}

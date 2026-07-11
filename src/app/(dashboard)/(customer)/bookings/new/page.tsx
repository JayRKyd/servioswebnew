'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { UKDateInput } from '@/components/shared/UKDateInput'

export default function NewBookingPage() {
  return <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-400">Loading…</div>}><NewBookingForm /></Suspense>
}

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function checkAvailability(availability: any, dateStr: string, timeStr: string): string | null {
  if (!availability) return null
  const date = new Date(dateStr)
  const dayKey = DAY_KEYS[date.getDay()]

  if (availability.blocked_dates?.includes(dateStr)) return 'This date is blocked — the provider is unavailable.'
  if (!availability[`${dayKey}_enabled`]) return `The provider does not work on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}s.`

  if (timeStr) {
    const slotMins = timeToMinutes(timeStr)
    const startMins = timeToMinutes(availability[`${dayKey}_start`] ?? '09:00')
    const endMins = timeToMinutes(availability[`${dayKey}_end`] ?? '17:00')

    if (slotMins < startMins || slotMins >= endMins)
      return `The provider is only available ${availability[`${dayKey}_start`]} – ${availability[`${dayKey}_end`]} on this day.`

    const breakStart = availability[`${dayKey}_break_start`]
    const breakEnd = availability[`${dayKey}_break_end`]
    if (breakStart && breakEnd) {
      const bStartMins = timeToMinutes(breakStart)
      const bEndMins = timeToMinutes(breakEnd)
      if (slotMins >= bStartMins && slotMins < bEndMins)
        return `The provider is on a break ${breakStart} – ${breakEnd}. Please choose a different time.`
    }
  }
  return null
}

function NewBookingForm() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [services, setServices] = useState<any[]>([])
  const [form, setForm] = useState({
    service_id: searchParams.get('service') ?? '',
    provider_id: searchParams.get('provider') ?? '',
    scheduled_date: '',
    scheduled_time_start: '',
    customer_notes: '',
    is_emergency: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [providerAvailability, setProviderAvailability] = useState<any>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)

  useEffect(() => {
    const providerId = searchParams.get('provider')
    if (providerId) {
      // Load provider's services and availability in parallel
      supabase.from('provider_profiles').select('id').eq('user_id', providerId).single()
        .then(async ({ data: pp }) => {
          if (!pp) return
          const [{ data: svcData }, { data: avail }] = await Promise.all([
            supabase.from('provider_services')
              .select('service:services(id, title, base_price, service_categories(name))')
              .eq('provider_id', pp.id).eq('is_active', true),
            supabase.from('provider_availability')
              .select('*').eq('provider_id', providerId).maybeSingle(),
          ])
          setServices((svcData ?? []).map((d: any) => d.service).filter(Boolean))
          if (avail) setProviderAvailability(avail)
        })
    } else {
      supabase.from('services').select('id, title, base_price, service_categories(name)').eq('is_active', true).order('title').then(({ data }) => setServices(data ?? []))
    }
  }, [])

  function set(key: string, value: any) {
    setForm(f => {
      const updated = { ...f, [key]: value }
      if ((key === 'scheduled_date' || key === 'scheduled_time_start') && providerAvailability) {
        const date = key === 'scheduled_date' ? value : updated.scheduled_date
        const time = key === 'scheduled_time_start' ? value : updated.scheduled_time_start
        if (date) setAvailabilityError(checkAvailability(providerAvailability, date, time))
      }
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (availabilityError) return
    setSubmitting(true)
    setError(null)

    const { data: customerProfile, error: cpError } = await supabase
      .from('customer_profiles').select('id').eq('user_id', user.id).maybeSingle()
    if (cpError || !customerProfile) { setError('Customer profile not found'); setSubmitting(false); return }

    let resolvedProviderId: string | null = null
    if (form.provider_id) {
      const { data: pp } = await supabase
        .from('provider_profiles').select('id').eq('user_id', form.provider_id).maybeSingle()
      resolvedProviderId = pp?.id ?? null
    }

    // Commission: 15% emergency, 10% landlord, 12% default
    const bookingTypeVal = searchParams.get('type') ?? 'direct_customer'
    const commissionRate = form.is_emergency ? 0.15 : bookingTypeVal === 'landlord' ? 0.10 : 0.12
    const selectedService = services.find((s: any) => s.id === form.service_id)
    const baseAmount = selectedService?.base_price ? Math.round(selectedService.base_price * 100) : 0
    const platformFee = Math.round(baseAmount * commissionRate)
    const totalAmount = baseAmount + platformFee

    // Upload any customer photos after booking creation
    const uploadPhotos = async (bookingId: string) => {
      for (const file of photos) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const storagePath = `${bookingId}/before_customer_${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('booking-photos').upload(storagePath, file, { contentType: file.type })
        if (!upErr) {
          await supabase.from('booking_photos').insert({
            booking_id: bookingId,
            uploaded_by: user.id,
            storage_path: storagePath,
            type: 'before',
          })
        }
      }
    }

    const { data, error } = await supabase.from('bookings').insert({
      customer_id: customerProfile.id,
      service_id: form.service_id,
      provider_id: resolvedProviderId,
      scheduled_date: form.scheduled_date,
      scheduled_time_start: form.scheduled_time_start,
      customer_notes: form.customer_notes,
      is_emergency: form.is_emergency,
      status: 'pending',
      booking_type: bookingTypeVal,
      base_amount: baseAmount,
      platform_fee: platformFee,
      total_amount: totalAmount,
      commission_rate: commissionRate,
    }).select().maybeSingle()
    if (error) { setError(error.message); setSubmitting(false); return }

    if (photos.length > 0 && data?.id) { await uploadPhotos(data.id) }

    // Notify provider about new booking
    if (resolvedProviderId) {
      const { data: provUser } = await supabase.from('provider_profiles').select('user_id').eq('id', resolvedProviderId).single()
      if (provUser?.user_id) {
        await supabase.from('notifications').insert({
          user_id: provUser.user_id,
          notification_type: 'booking_new',
          title: 'New booking request',
          body: `You have a new ${form.is_emergency ? 'emergency ' : ''}booking request for ${selectedService?.title ?? 'a service'}.`,
          data: { booking_id: data.id },
        })
      }
    }

    router.push('/bookings/' + data.id)
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Book a Service</h1>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
          <select required value={form.service_id} onChange={e => set('service_id', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">Select a service…</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.service_categories?.name ? `${s.service_categories.name} — ` : ''}{s.title}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <UKDateInput required value={form.scheduled_date} onChange={v => set('scheduled_date', v)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
          <input required type="time" value={form.scheduled_time_start} onChange={e => set('scheduled_time_start', e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${availabilityError ? 'border-red-400' : 'border-gray-300'}`} />
          {availabilityError && (
            <p className="mt-1.5 text-xs text-red-600">{availabilityError}</p>
          )}
          {providerAvailability && !availabilityError && form.scheduled_date && form.scheduled_time_start && (
            <p className="mt-1.5 text-xs text-green-600">✓ This slot is within the provider's working hours.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea rows={3} value={form.customer_notes} onChange={e => set('customer_notes', e.target.value)}
            placeholder="Any special instructions…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Photos <span className="text-gray-400 font-normal">(optional — help the provider understand the job)</span></label>
          <div className="space-y-2">
            {photos.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <span className="truncate text-gray-700">{f.name}</span>
                <button type="button" onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))} className="ml-2 text-red-500 hover:text-red-700 text-xs">Remove</button>
              </div>
            ))}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-primary hover:text-primary">
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
                const files = Array.from(e.target.files ?? [])
                setPhotos(ps => [...ps, ...files])
                e.target.value = ''
              }} />
              📷 Add photos
            </label>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.is_emergency} onChange={e => set('is_emergency', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary" />
          <span className="text-sm font-medium text-red-600">Emergency booking</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting || !!availabilityError}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit Booking Request'}
        </button>
      </form>
    </div>
  )
}

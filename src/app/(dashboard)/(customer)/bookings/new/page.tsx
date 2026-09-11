'use client'
import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Camera } from 'lucide-react'
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
      return `The provider is only available ${String(availability[`${dayKey}_start`]).slice(0, 5)} – ${String(availability[`${dayKey}_end`]).slice(0, 5)} on this day.`

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
  const quoteContext = searchParams.get('context') ?? ''
  const [services, setServices] = useState<any[]>([])
  const [form, setForm] = useState({
    service_id: searchParams.get('service') ?? '',
    provider_id: searchParams.get('provider') ?? '',
    scheduled_date: '',
    scheduled_time_start: '',
    customer_notes: quoteContext ? `Quote details: ${quoteContext}` : '',
    is_emergency: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [providerAvailability, setProviderAvailability] = useState<any>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [providerBookable, setProviderBookable] = useState(true)
  const [providerHasServices, setProviderHasServices] = useState(true)
  const [providerVerified, setProviderVerified] = useState(true)
  const [providerInfo, setProviderInfo] = useState<any>(null)

  useEffect(() => {
    const providerId = searchParams.get('provider')
    if (providerId) {
      // Load provider's services and availability in parallel
      supabase.from('provider_profiles')
        .select('id, verification_status, business_name, first_name, last_name, profile_image_url, rating_average, total_reviews, trade_category')
        .eq('user_id', providerId).single()
        .then(async ({ data: pp }) => {
          if (!pp) return
          setProviderInfo(pp)
          setProviderVerified(pp.verification_status === 'verified')
          const [{ data: svcData }, { data: avail }] = await Promise.all([
            supabase.from('provider_services')
              .select('service:services(id, title, base_price, price_type, service_categories(name))')
              .eq('provider_id', pp.id).eq('is_active', true),
            supabase.from('provider_availability')
              .select('*').eq('provider_id', providerId).maybeSingle(),
          ])
          const svcs = (svcData ?? []).map((d: any) => d.service).filter(Boolean)
          setServices(svcs)
          setProviderHasServices(svcs.length > 0)
          if (avail) setProviderAvailability(avail)
          // No working hours saved (or every day off) = not bookable yet
          const hasWorkingDay = avail && DAY_KEYS.some(k => avail[`${k}_enabled`])
          setProviderBookable(!!hasWorkingDay)
        })
    } else {
      supabase.from('services').select('id, title, base_price, service_categories(name)').eq('is_active', true).is('provider_id', null).order('title').then(({ data }) => setServices(data ?? []))
    }
  }, [])

  function set(key: string, value: any) {
    // Fixing the field clears any stale submit error — it used to stick
    if (key === 'scheduled_date' || key === 'scheduled_time_start') setError(null)
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
    if (availabilityError || !providerBookable || !providerHasServices || !providerVerified) return

    // No £0 bookings: only services with a real fixed price book directly —
    // hourly and quote-priced work goes through messages/quotes so an amount
    // exists before anything is charged
    const svc = services.find((s: any) => s.id === form.service_id)
    if (!svc || !(Number(svc.base_price) > 0)) {
      setError('This service is priced individually — message the provider or request a quote to agree a price first.')
      return
    }

    // Validate the date before it can reach Postgres — UKDateInput is a text
    // field, so form state can be empty or stale even when the input shows text
    const todayISO = new Date().toISOString().split('T')[0]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.scheduled_date)) {
      setError('Please enter a valid date (DD/MM/YYYY).')
      return
    }
    if (form.scheduled_date < todayISO) {
      setError('That date has already passed — please choose a future date.')
      return
    }

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

    // Block double booking: the same provider, date and start time must not
    // already hold a live booking. (Racy without a DB constraint, but catches
    // the normal path; a matching partial unique index backs this up.)
    if (resolvedProviderId) {
      const { data: clash } = await supabase
        .from('bookings')
        .select('id')
        .eq('provider_id', resolvedProviderId)
        .eq('scheduled_date', form.scheduled_date)
        .eq('scheduled_time_start', form.scheduled_time_start)
        .in('status', ['pending', 'accepted', 'in_progress'])
        .limit(1)
      if (clash && clash.length > 0) {
        setError('That time slot is already booked with this provider — please choose another time.')
        setSubmitting(false)
        return
      }
    }

    // Commission model (confirmed 2026-09-11): the customer pays the listed
    // price and nothing more; Servios keeps the commission out of the
    // provider's side. total = base; platform_fee is the provider deduction.
    // Rates: 15% emergency, 10% landlord, 12% default.
    const bookingTypeVal = searchParams.get('type') ?? 'direct_customer'
    const commissionRate = form.is_emergency ? 0.15 : bookingTypeVal === 'landlord' ? 0.10 : 0.12
    const selectedService = services.find((s: any) => s.id === form.service_id)
    const baseAmount = selectedService?.base_price ? Math.round(selectedService.base_price * 100) : 0
    const platformFee = Math.round(baseAmount * commissionRate)
    const totalAmount = baseAmount

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
            url: storagePath,
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
    if (error) {
      // Never surface raw Postgres messages to the customer
      const friendly = error.code === '23505'
        ? 'That time slot is already booked with this provider — please choose another time.'
        : error.message.includes('invalid input syntax')
          ? 'Something was wrong with the date or time — please check them and try again.'
          : 'We couldn’t create your booking. Please try again, or contact support if it keeps happening.'
      console.error('Booking insert failed:', error)
      setError(friendly)
      setSubmitting(false)
      return
    }

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

  // A booking must be tied to a provider — a provider-less booking is never
  // seen or accepted by anyone. Direct arrivals get routed into the funnel.
  if (!searchParams.get('provider')) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
          <h1 className="text-xl font-bold text-gray-900">First, choose your provider</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
            Bookings on Servios go to a specific professional. Answer a few quick questions
            and we&apos;ll match you — or browse and compare providers yourself.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/book" className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
              Get matched — Get Quotes
            </Link>
            <Link href="/search" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Browse providers
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Live pricing for the summary card — customers pay the listed price, no fees
  const summaryService = services.find((s: any) => s.id === form.service_id)
  const summaryBase = summaryService?.base_price ?? 0
  const providerName = providerInfo
    ? (providerInfo.business_name?.trim() || `${providerInfo.first_name ?? ''} ${providerInfo.last_name ?? ''}`.trim())
    : null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Book a Service</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr,340px] lg:items-start">
      <div className="space-y-6 order-last lg:order-none">

      {!providerVerified && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">This provider hasn&apos;t been verified yet</p>
          <p className="mt-0.5 text-xs text-amber-700">
            They can&apos;t take bookings until our team verifies their identity and documents. Please choose another provider.
          </p>
        </div>
      )}

      {!providerHasServices && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">This provider hasn&apos;t listed any services yet</p>
          <p className="mt-0.5 text-xs text-amber-700">
            There&apos;s nothing to book until they add one — send them a message instead, or choose another provider.
          </p>
        </div>
      )}

      {!providerBookable && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">This provider hasn&apos;t set their working hours yet</p>
          <p className="mt-0.5 text-xs text-amber-700">
            You can&apos;t book them until they do — send them a message instead, or choose another provider.
          </p>
        </div>
      )}

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
              <Camera size={15} /> Add photos
            </label>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.is_emergency} onChange={e => set('is_emergency', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary" />
          <span className="text-sm font-medium text-red-600">Emergency booking</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={submitting || !!availabilityError || !providerBookable || !providerHasServices || !providerVerified}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Submit Booking Request'}
        </button>
      </form>
      </div>

      {/* ── Sticky booking summary — keeps provider, service, time and price
             visible beside every field (Round 3 review #21 / design #29) ── */}
      <aside className="lg:sticky lg:top-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-4">
        {providerInfo && (
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            {providerInfo.profile_image_url ? (
              <img src={providerInfo.profile_image_url} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-gray-200" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {(providerName ?? 'P').charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{providerName}</p>
              <p className="text-xs text-gray-500">
                {Number(providerInfo.rating_average) > 0
                  ? `★ ${Number(providerInfo.rating_average).toFixed(1)} · ${providerInfo.total_reviews ?? 0} review${(providerInfo.total_reviews ?? 0) !== 1 ? 's' : ''}`
                  : 'New to Servios'}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Service</span>
            <span className="text-right font-medium text-gray-900">{summaryService?.title ?? 'Not selected yet'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Date</span>
            <span className="font-medium text-gray-900">
              {form.scheduled_date ? new Date(form.scheduled_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Time</span>
            <span className="font-medium text-gray-900">{form.scheduled_time_start || '—'}</span>
          </div>
        </div>

        {summaryService?.base_price != null && summaryBase > 0 ? (
          <div className="space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{summaryService.title}</span>
              <span className="text-gray-900">£{summaryBase.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
              <span>Total — no fees for you</span>
              <span>£{summaryBase.toFixed(2)}</span>
            </div>
          </div>
        ) : summaryService ? (
          <p className="border-t border-gray-100 pt-4 text-xs leading-relaxed text-amber-700">
            This service is priced individually — message the provider or request
            a quote to agree a price before booking.
          </p>
        ) : (
          <p className="border-t border-gray-100 pt-4 text-xs text-gray-400">
            Select a service to see the price breakdown.
          </p>
        )}

        <p className="rounded-lg bg-primary/[0.06] px-3 py-2.5 text-xs leading-relaxed text-gray-600">
          Payment is held securely and only released when the job is done.
          Every job is backed by the 90-day workmanship guarantee.
        </p>
      </aside>
      </div>
    </div>
  )
}

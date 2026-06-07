'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'

const UK_AREAS = [
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool',
  'Bristol', 'Sheffield', 'Edinburgh', 'Cardiff', 'Leicester', 'Nottingham',
  'Newcastle', 'Bradford', 'Coventry', 'Southampton', 'Portsmouth', 'Reading',
]

const GROUP_LABELS: Record<string, string> = {
  trades_repairs: 'Trades & Repairs',
  property_professionals: 'Property Professionals',
  cleaning: 'Cleaning Services',
  automotive: 'Automotive & Mobile Vehicle Services',
  specialist: 'Specialist Restoration & Craft',
}
const GROUP_ORDER = ['trades_repairs', 'property_professionals', 'cleaning', 'automotive', 'specialist']

interface Trade { slug: string; name: string; group_slug: string }

/** Crop the raw image to the selected pixel area and return a PNG blob. */
async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const size = Math.min(pixelCrop.width, pixelCrop.height)
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, size, size)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas empty')), 'image/jpeg', 0.92)
    }
    img.onerror = reject
    img.src = imageSrc
  })
}

export default function EditProviderProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  // Form state
  const [form, setForm] = useState({
    first_name: '', last_name: '', business_name: '', bio: '',
    hourly_rate: '', service_areas: [] as string[],
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationSet, setLocationSet] = useState(false)
  const [baseLocation, setBaseLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [tradesByGroup, setTradesByGroup] = useState<Record<string, Trade[]>>({})
  const [selectedTrades, setSelectedTrades] = useState<string[]>([])
  const [showAllGroups, setShowAllGroups] = useState<Record<string, boolean>>({})

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Load trades from DB
  useEffect(() => {
    supabase
      .from('service_categories')
      .select('slug, name, group_slug')
      .eq('is_active', true)
      .not('group_slug', 'is', null)
      .order('display_order')
      .then(({ data }) => {
        const seen = new Set<string>()
        const grouped: Record<string, Trade[]> = {}
        ;(data ?? []).forEach((c: any) => {
          if (seen.has(c.slug)) return
          seen.add(c.slug)
          if (!grouped[c.group_slug]) grouped[c.group_slug] = []
          grouped[c.group_slug].push(c)
        })
        setTradesByGroup(grouped)
      })
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('provider_profiles')
      .select('first_name, last_name, business_name, bio, hourly_rate, service_areas, base_location, profile_image_url, trade_categories, trade_category')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            first_name: data.first_name ?? '',
            last_name: data.last_name ?? '',
            business_name: data.business_name ?? '',
            bio: data.bio ?? '',
            hourly_rate: data.hourly_rate?.toString() ?? '',
            service_areas: data.service_areas ?? [],
          })
          if (data.base_location?.lat) { setBaseLocation(data.base_location); setLocationSet(true) }
          if (data.profile_image_url) setAvatarUrl(data.profile_image_url)
          if (data.trade_categories?.length) setSelectedTrades(data.trade_categories)
          else if (data.trade_category) setSelectedTrades([data.trade_category])
        }
      })
  }, [user?.id])

  function toggleTrade(slug: string) {
    setSelectedTrades(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    )
  }

  function set(key: string, value: any) { setForm(f => ({ ...f, [key]: value })) }

  function toggleArea(area: string) {
    setForm(f => ({
      ...f,
      service_areas: f.service_areas.includes(area)
        ? f.service_areas.filter(i => i !== area)
        : [...f.service_areas, area],
    }))
  }

  /** File selected — open crop modal instead of uploading immediately */
  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset input so picking the same file again still triggers onChange
    e.target.value = ''
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Photo must be under 10 MB'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      setCropSrc(ev.target?.result as string)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function applyCrop() {
    if (!cropSrc || !croppedAreaPixels || !user) return
    setUploadingAvatar(true)
    setError(null)
    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels)
      const storagePath = `${user.id}/avatar.jpg`
      await supabase.storage.from('provider-avatars').remove([storagePath])
      const { error: upErr } = await supabase.storage
        .from('provider-avatars')
        .upload(storagePath, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw new Error(upErr.message)
      const { data: urlData } = supabase.storage.from('provider-avatars').getPublicUrl(storagePath)
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`
      await supabase.from('provider_profiles').update({ profile_image_url: publicUrl }).eq('user_id', user.id)
      setAvatarUrl(publicUrl)
      setCropSrc(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingAvatar(false)
    }
  }

  function detectLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBaseLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationSet(true)
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 10_000 },
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)
    const payload: Record<string, any> = {
      first_name: form.first_name,
      last_name: form.last_name,
      business_name: form.business_name,
      bio: form.bio,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
      service_areas: form.service_areas,
      trade_categories: selectedTrades,
      trade_category: selectedTrades[0] ?? null,
    }
    if (baseLocation) payload.base_location = baseLocation
    const { error } = await supabase.from('provider_profiles').update(payload).eq('user_id', user.id)
    if (error) { setError(error.message); setSaving(false); return }
    router.push('/provider/profile')
  }

  const displayName = form.business_name || `${form.first_name} ${form.last_name}`.trim()

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">

        {/* ── Profile photo ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-5">
          <div className="relative h-20 w-20 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-100" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white">
                {displayName.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Profile Photo</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {avatarUrl ? 'Change photo' : 'Upload photo'}
            </button>
            <p className="mt-1 text-xs text-gray-400">JPG or PNG, max 10 MB</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {(['first_name', 'last_name'] as const).map(k => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {k === 'first_name' ? 'First Name' : 'Last Name'}
              </label>
              <input
                required
                value={form[k]}
                onChange={e => set(k, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
          <input
            required
            value={form.business_name}
            onChange={e => set('business_name', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea
            rows={3}
            value={form.bio}
            onChange={e => set('bio', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (£/hr)</label>
          <input
            type="number"
            step="0.01"
            value={form.hourly_rate}
            onChange={e => set('hourly_rate', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* ── Your Trades ──────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Trades</label>
          {selectedTrades.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {selectedTrades.map(slug => {
                const label = Object.values(tradesByGroup).flat().find(t => t.slug === slug)?.name ?? slug
                return (
                  <span key={slug} className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">
                    {label}
                    <button type="button" onClick={() => toggleTrade(slug)} className="ml-0.5 opacity-70 hover:opacity-100">✕</button>
                  </span>
                )
              })}
            </div>
          )}
          <div className="space-y-4">
            {GROUP_ORDER.filter(g => tradesByGroup[g]?.length).map(group => {
              const trades = tradesByGroup[group]
              const showing = showAllGroups[group] ? trades : trades.slice(0, 8)
              return (
                <div key={group}>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">{GROUP_LABELS[group]}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {showing.map(trade => {
                      const isSel = selectedTrades.includes(trade.slug)
                      return (
                        <button
                          key={trade.slug}
                          type="button"
                          onClick={() => toggleTrade(trade.slug)}
                          className={
                            'rounded-full border px-2.5 py-1 text-xs font-medium transition ' +
                            (isSel
                              ? 'border-primary bg-primary text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50')
                          }
                        >
                          {isSel ? '✓ ' : ''}{trade.name}
                        </button>
                      )
                    })}
                    {trades.length > 8 && (
                      <button type="button" onClick={() => setShowAllGroups(p => ({ ...p, [group]: !p[group] }))}
                        className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs text-gray-400 hover:border-gray-400">
                        {showAllGroups[group] ? 'Show less' : `+${trades.length - 8} more`}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Service Areas</label>
          <div className="flex flex-wrap gap-2">
            {UK_AREAS.map(area => (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={
                  'rounded-full border-2 px-3 py-1 text-xs font-medium transition ' +
                  (form.service_areas.includes(area)
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200')
                }
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Location</label>
          {locationSet
            ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-200">
                <span>📍</span><span>Location saved</span>
                <button
                  type="button"
                  onClick={() => { setLocationSet(false); setBaseLocation(null) }}
                  className="ml-auto text-xs text-gray-400 hover:text-red-500"
                >
                  Remove
                </button>
              </div>
            )
            : (
              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-primary hover:text-primary transition disabled:opacity-50"
              >
                {locating ? 'Detecting…' : '📍 Use my current location'}
              </button>
            )
          }
          <p className="mt-1 text-xs text-gray-400">Used to show your distance to customers on search</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving || uploadingAvatar}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </form>

      {/* ── Crop modal ─────────────────────────────────────────────────────── */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-900">Crop your photo</p>
              <p className="text-xs text-gray-500 mt-0.5">Drag to reposition · scroll to zoom</p>
            </div>

            {/* Cropper canvas */}
            <div className="relative h-72 bg-gray-900 overflow-hidden">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-5 py-3 flex items-center gap-3">
              <span className="text-xs text-gray-400 shrink-0">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                type="button"
                onClick={() => setCropSrc(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCrop}
                disabled={uploadingAvatar}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {uploadingAvatar ? 'Saving…' : 'Crop & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

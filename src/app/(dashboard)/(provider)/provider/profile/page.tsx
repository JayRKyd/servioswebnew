'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import {
  Star, BadgeCheck, MapPin, Share2, MoreHorizontal,
  ArrowUpDown, Crown, Pencil, Check, X, Plus, Camera,
} from 'lucide-react'

/* ─── helpers ─── */
function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={14}
          className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'} />
      ))}
    </span>
  )
}

function relativeDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 30) return `${diff} days ago`
  if (diff < 365) return `${Math.floor(diff / 30)} months ago`
  return `${Math.floor(diff / 365)} years ago`
}

function UKLocalTime() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () => setTime(new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London',
    }).format(new Date()))
    fmt()
    const id = setInterval(fmt, 60_000)
    return () => clearInterval(id)
  }, [])
  return <>{time}</>
}

/* ─── inline edit wrappers ─── */
function EditableText({
  value, placeholder, onSave, multiline = false,
}: {
  value: string; placeholder: string; onSave: (v: string) => Promise<boolean>; multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)

  // keep draft in sync when parent value changes after a successful save
  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) setEditing(false)
    else setError('Failed to save — please try again.')
  }
  function cancel() { setDraft(value); setEditing(false); setError(null) }

  if (editing) {
    return (
      <div className="space-y-2">
        {multiline ? (
          <textarea ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-primary px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
        ) : (
          <input ref={ref as any} value={draft} onChange={e => setDraft(e.target.value)}
            className="w-full rounded-lg border border-primary px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30" />
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
            <Check size={12} /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={cancel} disabled={saving}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
            <X size={12} /> Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-2">
      <span className="flex-1 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
        {value || <span className="italic text-gray-400">{placeholder}</span>}
      </span>
      <button onClick={() => setEditing(true)}
        className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-primary hover:border-primary">
        <Pencil size={11} />
      </button>
    </div>
  )
}

function EditableNumber({
  value, placeholder, prefix = '', suffix = '', onSave,
}: {
  value: number | null; placeholder: string; prefix?: string; suffix?: string; onSave: (v: number | null) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  // keep draft in sync when parent value changes
  useEffect(() => { if (!editing) setDraft(value?.toString() ?? '') }, [value, editing])

  async function handleSave() {
    setSaving(true)
    const ok = await onSave(draft ? parseFloat(draft) : null)
    setSaving(false)
    if (ok) setEditing(false)
  }
  function cancel() { setDraft(value?.toString() ?? ''); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">{prefix}</span>
        <input autoFocus type="number" value={draft} onChange={e => setDraft(e.target.value)}
          className="w-24 rounded-lg border border-primary px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        <span className="text-sm text-gray-500">{suffix}</span>
        <button onClick={handleSave} disabled={saving} className="h-6 w-6 flex items-center justify-center rounded-full bg-primary text-white disabled:opacity-60"><Check size={11} /></button>
        <button onClick={cancel} disabled={saving} className="h-6 w-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-400"><X size={11} /></button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2">
      <span className="text-xl font-bold text-gray-900">
        {value != null ? `${prefix}${value}${suffix}` : <span className="text-gray-400 font-normal text-sm">{placeholder}</span>}
      </span>
      <button onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-primary hover:border-primary">
        <Pencil size={11} />
      </button>
    </div>
  )
}

function EditableList({
  items, label, placeholder, onSave,
}: {
  items: string[]; label: string; placeholder: string; onSave: (v: string[]) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(items)
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // keep draft in sync when parent items change
  useEffect(() => { if (!editing) setDraft(items) }, [items, editing])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) setEditing(false)
    else setError('Failed to save — please try again.')
  }
  function cancel() { setDraft(items); setEditing(false); setError(null) }
  function remove(i: number) { setDraft(d => d.filter((_, idx) => idx !== i)) }
  function add() {
    if (!newItem.trim()) return
    setDraft(d => [...d, newItem.trim()])
    setNewItem('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="h-6 w-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-primary hover:border-primary">
            <Pencil size={11} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {draft.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="flex-1 text-sm text-gray-700 bg-gray-50 rounded px-2 py-0.5">{item}</span>
              <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500"><X size={13} /></button>
            </div>
          ))}
          <div className="flex gap-1.5 mt-1">
            <input value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <button onClick={add} className="h-7 w-7 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-primary hover:text-white">
              <Plus size={13} />
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"><Check size={11} /> {saving ? 'Saving…' : 'Save'}</button>
            <button onClick={cancel} disabled={saving} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500"><X size={11} /> Cancel</button>
          </div>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item, i) => {
            const [name, level] = item.split(':').map(s => s.trim())
            return level ? (
              <p key={i} className="text-sm text-gray-600">{name}: <span className="text-primary font-medium">{level}</span></p>
            ) : (
              <p key={i} className="text-sm text-gray-600">{item}</p>
            )
          })}
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs text-primary hover:underline">
          Add {label.toLowerCase()} →
        </button>
      )}
    </div>
  )
}

/* ─── main page ─── */
export default function ProviderProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [latestReview, setLatestReview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bioExpanded, setBioExpanded] = useState(false)
  const [cityEditing, setCityEditing] = useState(false)
  const [cityDraft, setCityDraft] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('provider_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('reviews').select('*').eq('reviewee_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]).then(([{ data: p }, { data: r }]) => {
      setProfile(p)
      setLatestReview(r)
      setLoading(false)
    })
  }, [user?.id])

  async function save(field: string, value: any): Promise<boolean> {
    const { error } = await supabase
      .from('provider_profiles')
      .update({ [field]: value })
      .eq('user_id', user!.id)
      .select('id')
      .single()
    if (error) {
      console.error(`Failed to save ${field}:`, error.message)
      return false
    }
    setProfile((p: any) => ({ ...p, [field]: value }))
    return true
  }

  async function uploadAvatar(file: File) {
    if (!user) return
    setAvatarUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await save('profile_image_url', publicUrl)
    }
    setAvatarUploading(false)
  }

  if (loading) return <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
  if (!profile) return (
    <div className="text-gray-400">
      Profile not found.{' '}
      <Link href="/provider/profile/edit" className="text-primary hover:underline">Create your profile →</Link>
    </div>
  )

  const tradingYear = profile.verified_at
    ? new Date(profile.verified_at).getFullYear()
    : profile.created_at ? new Date(profile.created_at).getFullYear() : new Date().getFullYear()

  const displayName = profile.business_name ?? `${profile.first_name} ${profile.last_name}`
  const initials = (profile.business_name?.[0] ?? profile.first_name?.[0] ?? 'P').toUpperCase()

  const bio = profile.bio ?? ''
  const BIO_LIMIT = 300
  const bioTruncated = bio.length > BIO_LIMIT

  const areas: string[] = profile.service_areas ?? profile.islands ?? []
  const trades: string[] = profile.trade_categories ?? []
  const licenses: string[] = profile.licenses ?? []
  const languages: string[] = profile.languages ?? []

  const headline = trades.length > 0
    ? trades.map((t: string) => t.replace(/_/g, ' ')).join(' | ')
    : displayName

  const rating = Number(profile.rating_average)
  const jobs = profile.total_jobs_completed ?? 0
  const isTopRated = rating >= 4.7 && jobs >= 3

  // ── Profile completeness ──
  const COMPLETION_ITEMS = [
    { key: 'photo',     label: 'Add a profile photo',          weight: 15, done: !!profile.profile_image_url },
    { key: 'bio',       label: 'Write a bio',                  weight: 15, done: !!(profile.bio ?? '').trim() },
    { key: 'trades',    label: 'Add trade categories',         weight: 10, done: (profile.trade_categories ?? []).length > 0 },
    { key: 'rate',      label: 'Set your hourly rate',         weight: 10, done: profile.hourly_rate != null },
    { key: 'phone',     label: 'Add a phone number',           weight: 10, done: !!profile.phone },
    { key: 'location',  label: 'Add your location',            weight: 10, done: !!(profile.city || areas.length > 0) },
    { key: 'licenses',  label: 'Add licences / certifications',weight: 10, done: licenses.length > 0 },
    { key: 'verified',  label: 'Verify your identity',         weight: 10, done: !!profile.identity_verified },
    { key: 'languages', label: 'Add languages you speak',      weight:  5, done: languages.length > 0 },
    { key: 'areas',     label: 'Set service areas',            weight:  5, done: areas.length > 0 },
  ]
  const completionPct = COMPLETION_ITEMS.filter(i => i.done).reduce((s, i) => s + i.weight, 0)
  const pending = COMPLETION_ITEMS.filter(i => !i.done)
  const R = 28, CIRC = 2 * Math.PI * R
  const ringOffset = CIRC * (1 - completionPct / 100)
  const ringColour = completionPct >= 70 ? 'text-primary' : completionPct >= 40 ? 'text-amber-400' : 'text-rose-400'
  const barColour  = completionPct >= 70 ? 'bg-primary'   : completionPct >= 40 ? 'bg-amber-400'   : 'bg-rose-400'

  return (
    <div className="w-full">
      {/* page action row */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">My Profile</h1>
        <div className="flex items-center gap-3" />
      </div>

      {/* ── PROFILE COMPLETENESS BANNER ── */}
      {completionPct < 100 && (
        <div className="mb-5 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 px-5 py-4">
          <div className="flex items-start gap-5">

            {/* SVG ring */}
            <div className="relative shrink-0 flex items-center justify-center" style={{ width: 72, height: 72 }}>
              <svg width="72" height="72" className="-rotate-90" aria-hidden>
                <circle cx="36" cy="36" r={R} fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-100" />
                <circle
                  cx="36" cy="36" r={R} fill="none" stroke="currentColor" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={ringOffset}
                  className={`${ringColour} transition-all duration-700`}
                />
              </svg>
              <span className="absolute text-sm font-bold text-gray-900 rotate-0">{completionPct}%</span>
            </div>

            {/* Right column */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">Profile strength</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                    {completionPct < 40
                      ? 'Add key details so customers can find and trust you.'
                      : completionPct < 70
                      ? 'Looking good — a few more steps to stand out.'
                      : 'Almost there — complete your profile for maximum visibility.'}
                  </p>
                </div>
                <div className="shrink-0 pt-1 w-28">
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div className={`h-1.5 rounded-full transition-all duration-700 ${barColour}`} style={{ width: `${completionPct}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[10px] font-medium text-gray-400">{100 - completionPct}% to go</p>
                </div>
              </div>

              {pending.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {pending.map(item => (
                    <span key={item.key}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 bg-gray-50 px-2.5 py-0.5 text-[11px] text-gray-500">
                      <Plus size={9} className="shrink-0" />
                      {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {completionPct === 100 && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl bg-green-50 border border-green-100 px-5 py-3">
          <BadgeCheck size={16} className="text-green-600 shrink-0" />
          <p className="text-sm font-semibold text-green-800">Profile complete — you have maximum visibility on Servios.</p>
        </div>
      )}

      {/* ─── CARD ─── */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden flex flex-col min-h-[calc(100vh-8rem)]">

        {/* ── HEADER ── */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-start gap-5">

            {/* Avatar */}
            <div className="relative shrink-0 group/av">
              <div className="h-[84px] w-[84px] rounded-full bg-primary flex items-center justify-center text-white text-3xl font-bold overflow-hidden ring-2 ring-gray-100">
                {profile.profile_image_url
                  ? <img src={profile.profile_image_url} alt="" className="h-full w-full object-cover" />
                  : initials}
              </div>
              <span className="absolute bottom-1 left-1 h-3.5 w-3.5 rounded-full bg-green-400 ring-2 ring-white" />
              {/* Upload overlay */}
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity disabled:cursor-wait"
                title="Change photo"
              >
                {avatarUploading
                  ? <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  : <Camera size={20} className="text-white" />}
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = '' }}
              />
            </div>

            {/* Name block */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[1.375rem] font-bold text-gray-900 leading-tight">{displayName}</h2>
                {profile.identity_verified && <BadgeCheck size={21} className="text-primary shrink-0" />}
              </div>

              {profile.business_name && (profile.first_name || profile.last_name) && (
                <p className="text-sm text-gray-500 mt-0.5">{profile.first_name} {profile.last_name}</p>
              )}

              {/* Location + live UK time */}
              <div className="flex items-center gap-1 text-sm text-gray-500 mt-1.5">
                <MapPin size={13} className="shrink-0" />
                {cityEditing ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={cityDraft}
                      onChange={e => setCityDraft(e.target.value)}
                      placeholder="Enter city"
                      className="rounded-lg border border-primary px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      onKeyDown={async e => {
                        if (e.key === 'Enter') { const ok = await save('city', cityDraft || null); if (ok) setCityEditing(false) }
                        if (e.key === 'Escape') setCityEditing(false)
                      }}
                    />
                    <button
                      onClick={async () => { const ok = await save('city', cityDraft || null); if (ok) setCityEditing(false) }}
                      className="h-6 w-6 flex items-center justify-center rounded-full bg-primary text-white">
                      <Check size={11} />
                    </button>
                    <button
                      onClick={() => setCityEditing(false)}
                      className="h-6 w-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-400">
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="group flex items-center gap-1">
                    {profile.city ? (
                      <span>{profile.city}, UK – <UKLocalTime /> local time</span>
                    ) : areas.length > 0 ? (
                      <span>{areas[0]}, UK – <UKLocalTime /> local time</span>
                    ) : (
                      <button onClick={() => { setCityDraft(''); setCityEditing(true) }}
                        className="text-primary hover:underline text-xs">
                        Add location →
                      </button>
                    )}
                    {(profile.city || areas.length > 0) && (
                      <button
                        onClick={() => { setCityDraft(profile.city ?? areas[0] ?? ''); setCityEditing(true) }}
                        className="opacity-0 group-hover:opacity-100 ml-1 h-5 w-5 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-primary hover:border-primary transition-opacity">
                        <Pencil size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Badge pills */}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {isTopRated && (
                  <span className="inline-flex items-center gap-2 rounded-full border-2 border-gray-800 pl-1 pr-3 py-0.5 text-xs font-semibold text-gray-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800">
                      <Crown size={10} className="text-white" />
                    </span>
                    Top Rated
                  </span>
                )}
                {profile.identity_verified && (
                  <span className="inline-flex items-center gap-2 rounded-full border-2 border-gray-800 pl-1 pr-3 py-0.5 text-xs font-semibold text-gray-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-800">
                      <BadgeCheck size={10} className="text-white" />
                    </span>
                    ID Verified
                  </span>
                )}
                {(profile.badges ?? []).map((badge: string) => (
                  <span key={badge} className="inline-flex items-center gap-1 rounded-full border-2 border-gray-800 px-3 py-0.5 text-xs font-semibold text-gray-800">
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Top-right */}
            <div className="flex flex-col items-end gap-2 shrink-0 pt-1">
              <button className="h-8 w-8 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-gray-50">
                <MoreHorizontal size={16} />
              </button>
              <button className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                Share <Share2 size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ── STATS STRIP ── */}
        <div className="border-t border-gray-100 px-8 py-6 flex items-start gap-12">
          <div className="shrink-0">
            <p className="text-2xl font-bold text-gray-900">{jobs > 0 ? jobs : '0'}</p>
            <p className="text-xs text-gray-500 mt-1">Jobs completed</p>
          </div>

          <div className="shrink-0">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-gray-900">{rating > 0 ? rating.toFixed(1) : '—'}</p>
              {rating > 0 && <StarRow rating={rating} />}
            </div>
            <p className="text-xs text-gray-500 mt-1">Rating</p>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-gray-900 capitalize leading-snug">{headline}</p>
            <p className="text-xs text-gray-500 mt-1">Member since {tradingYear}</p>
          </div>

          {/* Editable rate */}
          <div className="shrink-0">
            <EditableNumber
              value={profile.hourly_rate ?? null}
              placeholder="Set hourly rate"
              prefix="£"
              suffix="/hr"
              onSave={v => save('hourly_rate', v)}
            />
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="border-t border-gray-100 flex flex-1">

          {/* ── SIDEBAR ── */}
          <aside className="w-60 shrink-0 border-r border-gray-100 px-7 py-7 space-y-7">

            {/* Avg. response */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Avg. response</p>
              <EditableNumber
                value={profile.avg_response_hours ?? null}
                placeholder="Set response time"
                suffix=" hrs"
                onSave={v => save('avg_response_hours', v)}
              />
            </div>

            {/* Phone */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Phone</p>
              <EditableText
                value={profile.phone ?? ''}
                placeholder="Add phone number"
                onSave={v => save('phone', v || null)}
              />
            </div>

            {/* Website */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Website</p>
              <EditableText
                value={profile.website ?? ''}
                placeholder="Add website URL"
                onSave={v => save('website', v || null)}
              />
            </div>

            {/* Verifications */}
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Verifications</p>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  ID:{' '}
                  {profile.identity_verified
                    ? <span className="text-primary font-medium inline-flex items-center gap-0.5">Verified <BadgeCheck size={13} /></span>
                    : <span className="text-gray-400">Not verified</span>}
                </p>
                {profile.phone && (
                  <p className="text-sm text-gray-600">
                    Phone number:{' '}
                    <span className="text-primary font-medium inline-flex items-center gap-0.5">Verified <BadgeCheck size={13} /></span>
                  </p>
                )}
              </div>
            </div>

            {/* Licenses */}
            <EditableList
              items={licenses}
              label="Licenses"
              placeholder="e.g. Gas Safe Registered"
              onSave={v => save('licenses', v)}
            />

            {/* Languages */}
            <EditableList
              items={languages}
              label="Languages"
              placeholder="e.g. English: Native"
              onSave={v => save('languages', v)}
            />

            {/* Service areas */}
            {areas.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-2">Service areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {areas.map((area: string) => (
                    <span key={area} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{area}</span>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 min-w-0 px-8 py-7 space-y-8">

            {/* Bio — editable inline */}
            <div>
              {bioTruncated && !bioExpanded ? (
                <div className="group flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {bio.slice(0, BIO_LIMIT)}…
                    </p>
                    <button onClick={() => setBioExpanded(true)}
                      className="mt-1 text-sm text-primary underline hover:no-underline">more</button>
                  </div>
                  <button onClick={() => setBioExpanded(true)}
                    className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:text-primary hover:border-primary">
                    <Pencil size={11} />
                  </button>
                </div>
              ) : (
                <EditableText
                  value={bio}
                  placeholder="No bio added yet. Click to write about yourself…"
                  multiline
                  onSave={async v => { const ok = await save('bio', v); if (ok) setBioExpanded(false); return ok }}
                />
              )}
            </div>

            {/* Work history */}
            <div className="border-t border-gray-100 pt-7">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">Work history</h3>
                <button className="h-7 w-7 flex items-center justify-center rounded-full border border-gray-300 text-gray-400 hover:bg-gray-50">
                  <ArrowUpDown size={13} />
                </button>
              </div>

              {/* Trade chips */}
              {trades.length > 0 && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Trades &amp; services</p>
                  <div className="flex flex-wrap gap-2">
                    {trades.map((t: string) => (
                      <span key={t} className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700 capitalize">
                        {t.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest review */}
              {latestReview ? (
                <div className="border-t border-gray-100 pt-5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center text-gray-600 text-xs font-bold shrink-0">
                      {latestReview.reviewer_name
                        ? latestReview.reviewer_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                        : '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StarRow rating={latestReview.rating} />
                          {latestReview.reviewer_name && (
                            <span className="text-sm font-semibold text-gray-700">{latestReview.reviewer_name}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{relativeDate(latestReview.created_at)}</span>
                      </div>
                      {latestReview.review_text && (
                        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                          {latestReview.review_text.length > 200
                            ? latestReview.review_text.slice(0, 200) + '…'
                            : latestReview.review_text}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link href="/provider/reviews" className="block text-sm text-primary hover:underline">
                    View all reviews →
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic border-t border-gray-100 pt-5">No reviews yet.</p>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

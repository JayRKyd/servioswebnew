'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronRight, RefreshCw, Search, ShieldCheck } from 'lucide-react'

interface Row { id: string; email: string; phone: string | null; roles: string[]; active_role: string; status: string | null; created_at: string; last_login_at: string | null; name: string | null }
const day = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const STATUS: Record<string, string> = { active: 'bg-green-50 text-green-700', suspended: 'bg-red-50 text-red-700', closed: 'bg-gray-200 text-gray-700' }

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}&role=${role}&status=${status}`, { cache: 'no-store' })
    const json: any = await res.json().catch(() => ({}))
    if (!res.ok) setError(json?.error ?? `Could not load (${res.status})`); else setRows(json.users ?? [])
    setLoading(false)
  }, [q, role, status])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-0.5 text-sm text-gray-500">{loading ? 'Loading…' : `${rows.length} shown`} · search by email, name, phone or booking reference</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50" aria-label="Refresh"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">{['all', 'customer', 'provider', 'landlord', 'tenant', 'admin'].map(r => <option key={r} value={r}>{r === 'all' ? 'Any role' : r}</option>)}</select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">{['all', 'active', 'suspended', 'closed'].map(s => <option key={s} value={s}>{s === 'all' ? 'Any status' : s}</option>)}</select>
      </div>
      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={15} /> {error}</div>}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400"><tr><th className="px-4 py-3">User</th><th className="hidden px-4 py-3 md:table-cell">Roles</th><th className="px-4 py-3">Status</th><th className="hidden px-4 py-3 lg:table-cell">Joined</th><th className="hidden px-4 py-3 lg:table-cell">Last sign-in</th><th className="w-8" /></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No users match.</td></tr>}
            {rows.map(u => (
              <tr key={u.id} className="group hover:bg-gray-50/60">
                <td className="px-4 py-3"><Link href={`/admin/users/${u.id}`} className="font-semibold text-gray-900 group-hover:text-primary">{u.name ?? u.email}</Link>{u.name && <p className="text-xs text-gray-500">{u.email}</p>}{u.phone && <p className="text-[11px] text-gray-400">{u.phone}</p>}</td>
                <td className="hidden px-4 py-3 md:table-cell"><div className="flex flex-wrap gap-1">{(u.roles ?? []).map(r => <span key={r} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r === 'admin' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}`}>{r === 'admin' && <ShieldCheck size={10} />}{r}</span>)}</div></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS[u.status ?? 'active'] ?? STATUS.active}`}>{u.status ?? 'active'}</span></td>
                <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">{day(u.created_at)}</td>
                <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">{day(u.last_login_at)}</td>
                <td className="pr-3"><Link href={`/admin/users/${u.id}`} aria-label="Open"><ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500" /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

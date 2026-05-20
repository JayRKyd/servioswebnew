'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/auth'

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([])
  const [category, setCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('services')
      .select('*, service_categories!category_id(name)')
      .eq('is_active', true)
      .order('title')
      .then(({ data }) => {
        const all = (data ?? []).map((s: any) => ({
          ...s,
          categoryName: s.service_categories?.name ?? 'Other',
        }))
        setServices(all)
        const cats = Array.from(new Set(all.map((s: any) => s.categoryName))) as string[]
        setCategories(cats.sort())
        setLoading(false)
      })
  }, [])

  const filtered = category === 'All' ? services : services.filter(s => s.categoryName === category)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Services</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(['All', ...categories]).map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ' + (category === c ? 'bg-primary text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-blue-300')}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => (
            <Link key={s.id} href={'/services/' + s.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition hover:ring-blue-300">
              <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-primary">{s.categoryName}</span>
              <p className="mt-2 font-semibold text-gray-900">{s.title}</p>
              {s.description && <p className="mt-1 text-sm text-gray-500 line-clamp-2">{s.description}</p>}
              <p className="mt-3 text-sm font-medium text-primary">Book now →</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

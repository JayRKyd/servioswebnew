'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/auth'
import { useProfileIds } from '@/hooks/useProfileIds'
import { formatDate } from '@/lib/utils'

export default function LandlordCompliancePage() {
  const { landlordId } = useProfileIds()
  const [items, setItems] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ property_id: '', item: '', due_date: '', status: 'pending' })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    if (!landlordId) return
    Promise.all([
      supabase.from('property_compliance')
        .select('*, properties!inner(id, name, landlord_id)')
        .eq('properties.landlord_id', landlordId)
        .order('due_date', { ascending: true }),
      supabase.from('properties').select('id, name').eq('landlord_id', landlordId).order('name'),
    ]).then(([{ data: compData }, { data: propData }]) => {
      setItems(compData ?? [])
      setProperties(propData ?? [])
      setLoading(false)
    })
  }, [landlordId])

  async function markCompliant(id: string) {
    setActing(id)
    await supabase.from('property_compliance').update({
      status: 'compliant',
      last_checked: new Date().toISOString(),
    }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'compliant', last_checked: new Date().toISOString() } : i))
    setActing(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.property_id || !addForm.item) return
    setAddSaving(true)
    setAddError(null)
    const { data, error } = await supabase.from('property_compliance').insert({
      property_id: addForm.property_id,
      item: addForm.item,
      due_date: addForm.due_date || null,
      status: addForm.status,
    }).select('*, properties(id, name)').single()
    if (error) { setAddError(error.message); setAddSaving(false); return }
    setItems(prev => [...prev, data].sort((a, b) =>
      (a.due_date ?? '9999') > (b.due_date ?? '9999') ? 1 : -1
    ))
    setAddForm({ property_id: '', item: '', due_date: '', status: 'pending' })
    setShowAdd(false)
    setAddSaving(false)
  }

  const overdue = items.filter(i => i.status === 'overdue')
  const pending = items.filter(i => i.status === 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Overview</h1>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          {showAdd ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {([['Overdue', overdue.length, 'text-red-600'], ['Pending', pending.length, 'text-yellow-600'], ['Total Items', items.length, 'text-gray-900']] as const).map(([label, count, cls]) => (
          <div key={label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={'mt-1 text-3xl font-bold ' + cls}>{count}</p>
          </div>
        ))}
      </div>

      {/* Add item form */}
      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 space-y-4">
          <p className="font-semibold text-gray-900">New Compliance Item</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
              <select required value={addForm.property_id} onChange={e => setAddForm(f => ({ ...f, property_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="">Select property…</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
              <input required value={addForm.item} onChange={e => setAddForm(f => ({ ...f, item: e.target.value }))}
                placeholder="e.g. Gas Safety Certificate"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={addForm.due_date} onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="compliant">Compliant</option>
              </select>
            </div>
          </div>
          {addError && <p className="text-sm text-red-600">{addError}</p>}
          <button type="submit" disabled={addSaving}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
            {addSaving ? 'Saving…' : 'Add Item'}
          </button>
        </form>
      )}

      {loading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        items.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">No compliance items yet — add one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex items-start justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{item.item}</p>
                  <p className="text-sm text-gray-500">{item.properties?.name}</p>
                  {item.due_date && <p className="text-xs text-gray-400">Due {formatDate(item.due_date)}</p>}
                  {item.last_checked && <p className="text-xs text-gray-400">Last checked {formatDate(item.last_checked)}</p>}
                </div>
                <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ' + (
                    item.status === 'compliant' ? 'bg-green-100 text-green-700' :
                    item.status === 'overdue' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  )}>
                    {item.status}
                  </span>
                  {item.status !== 'compliant' && (
                    <button
                      onClick={() => markCompliant(item.id)}
                      disabled={acting === item.id}
                      className="rounded-lg border border-green-300 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                    >
                      {acting === item.id ? 'Saving…' : 'Mark Compliant'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

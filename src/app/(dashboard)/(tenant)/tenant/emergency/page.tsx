'use client'
export default function EmergencyPage() {
  const contacts = [
    { label: 'Emergency Services', number: '911', description: 'Police, Fire, Ambulance', color: 'bg-red-600' },
    { label: 'Police (non-emergency)', number: '919', description: 'Royal Bahamas Police Force', color: 'bg-primary-dark' },
    { label: 'Bahamas Utilities', number: '1-242-325-4420', description: 'BEC / power outages', color: 'bg-orange-600' },
    { label: 'Water & Sewerage', number: '1-242-302-5581', description: 'WSC emergency line', color: 'bg-primary' },
  ]

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl bg-red-600 p-6 text-white">
        <h1 className="text-2xl font-bold">Emergency</h1>
        <p className="mt-1 text-red-200">In life-threatening emergencies call 911 immediately</p>
      </div>

      <div className="space-y-3">
        {contacts.map(c => (
          <a key={c.label} href={'tel:' + c.number} className={'flex items-center justify-between rounded-xl p-4 text-white transition hover:opacity-90 ' + c.color}>
            <div>
              <p className="font-semibold">{c.label}</p>
              <p className="text-sm opacity-80">{c.description}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{c.number}</p>
              <p className="text-xs opacity-70">Tap to call</p>
            </div>
          </a>
        ))}
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <p className="text-sm font-semibold text-gray-900 mb-2">Non-Emergency Tips</p>
        <ul className="space-y-1 text-sm text-gray-500 list-disc list-inside">
          <li>For maintenance issues, use the Report Issue form</li>
          <li>For urgent building matters, contact your landlord via chat</li>
          <li>Document any damage with photos before calling</li>
        </ul>
      </div>
    </div>
  )
}

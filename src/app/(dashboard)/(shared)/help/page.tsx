'use client'
import { useState } from 'react'

const FAQS = [
  { q: 'How do I get quotes?', a: 'Choose Get Quotes from your dashboard, describe the job, and select your location. You can then compare matched providers and submit a booking request.' },
  { q: 'How do I become a provider?', a: 'Sign up and select Provider as your role. Complete your profile with your business information, services, and service areas. Your account will be verified before you can receive bookings.' },
  { q: 'What payment methods are accepted?', a: 'We accept major credit and debit cards via Stripe. Payments are processed securely at the time of booking confirmation.' },
  { q: 'How do I cancel a booking?', a: 'Open the booking from My Bookings and tap Cancel Booking. Cancellations are free if made at least 24 hours before the scheduled time.' },
  { q: 'Where does Servios operate?', a: 'Servios currently operates across London — Central, North, South, East, West and Greater London. More UK areas are coming soon.' },
  { q: 'Is Servios free for customers?', a: 'Yes. Customers never pay a fee to use Servios — you only pay the price of the job itself, and every completed job is backed by our 90-day workmanship guarantee.' },
]

export default function HelpPage() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>

      <div className="space-y-2">
        {FAQS.map((faq, i) => (
          <div key={i} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between p-4 text-left">
              <span className="font-medium text-gray-900">{faq.q}</span>
              <span className="ml-4 text-gray-400 transition">{open === i ? '↑' : '↓'}</span>
            </button>
            {open === i && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                <p className="text-sm text-gray-600">{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-primary/[0.06] p-6 ring-1 ring-primary/30">
        <h2 className="font-semibold text-gray-900 mb-2">Still need help?</h2>
        <p className="text-sm text-gray-600 mb-4">Our support team is available Mon–Fri, 9am–6pm UK time.</p>
        <a href="mailto:support@servios.co.uk" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">Contact Support</a>
      </div>
    </div>
  )
}

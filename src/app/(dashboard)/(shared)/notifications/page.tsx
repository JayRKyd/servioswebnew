'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDate } from '@/lib/utils'

const NOTIF_ICONS: Record<string, string> = {
  booking_new: '📋',
  booking_accepted: '✅',
  booking_rejected: '❌',
  booking_in_progress: '🔨',
  booking_completed: '🎉',
  maintenance_new: '🔧',
  maintenance_approved: '✅',
  message_new: '💬',
  payment_received: '💰',
  review_new: '⭐',
  dispute_new: '⚠️',
}

export default function NotificationsPage() {
  const { notifications, isLoading, markAllRead } = useNotifications()

  useEffect(() => { markAllRead() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
      </div>
      {isLoading ? <div className="flex h-40 items-center justify-center text-gray-400">Loading…</div> :
        notifications.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => {
              const bookingId = n.data?.booking_id
              const inner = (
                <div className={'flex items-start gap-3 rounded-xl p-4 shadow-sm ring-1 transition ' + (n.is_read ? 'bg-white ring-gray-100' : 'bg-primary/[0.06] ring-primary/30')}>
                  <span className="text-xl shrink-0">{NOTIF_ICONS[n.notification_type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{n.title ?? n.notification_type?.replace(/_/g, ' ')}</p>
                    {n.body && <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>}
                    <p className="mt-1 text-xs text-gray-400">{formatDate(n.created_at)}</p>
                  </div>
                  {bookingId && <span className="text-xs text-primary shrink-0">View →</span>}
                </div>
              )
              return bookingId ? (
                <Link key={n.id} href={`/bookings/${bookingId}`}>{inner}</Link>
              ) : (
                <div key={n.id}>{inner}</div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

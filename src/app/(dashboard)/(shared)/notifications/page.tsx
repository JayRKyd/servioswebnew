'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useNotifications } from '@/hooks/useNotifications'
import { useActiveRole } from '@/hooks/useActiveRole'
import { formatDate } from '@/lib/utils'
import {
  Bell, Calendar, CheckCircle2, XCircle, Hammer, Wrench, MessageSquare,
  Banknote, Star, AlertTriangle, MessageSquareQuote, FileText,
} from 'lucide-react'

const NOTIF_ICONS: Record<string, { icon: React.ElementType; classes: string }> = {
  booking_new:         { icon: Calendar,           classes: 'bg-primary/10 text-primary' },
  booking_accepted:    { icon: CheckCircle2,       classes: 'bg-green-50 text-green-600' },
  booking_rejected:    { icon: XCircle,            classes: 'bg-red-50 text-red-500' },
  booking_in_progress: { icon: Hammer,             classes: 'bg-amber-50 text-amber-600' },
  booking_completed:   { icon: CheckCircle2,       classes: 'bg-green-50 text-green-600' },
  maintenance_new:     { icon: Wrench,             classes: 'bg-primary/10 text-primary' },
  maintenance_approved:{ icon: CheckCircle2,       classes: 'bg-green-50 text-green-600' },
  message_new:         { icon: MessageSquare,      classes: 'bg-primary/10 text-primary' },
  payment_received:    { icon: Banknote,           classes: 'bg-green-50 text-green-600' },
  review_new:          { icon: Star,               classes: 'bg-amber-50 text-amber-500' },
  dispute_new:         { icon: AlertTriangle,      classes: 'bg-orange-50 text-orange-600' },
  quote_request:       { icon: MessageSquareQuote, classes: 'bg-primary/10 text-primary' },
  offer_accepted:      { icon: FileText,           classes: 'bg-green-50 text-green-600' },
  offer_declined:      { icon: FileText,           classes: 'bg-gray-100 text-gray-500' },
}

export default function NotificationsPage() {
  const { notifications, isLoading, markAllRead } = useNotifications()
  const { activeRole } = useActiveRole()

  useEffect(() => { markAllRead() }, [])

  // Send each notification to the page where it can be acted on, for the
  // role that's looking at it
  function notificationHref(n: any): string | null {
    if (n.data?.conversation_id) return `/messages/${n.data.conversation_id}`
    if (n.data?.quote_request_id && activeRole === 'provider') return `/provider/quotes/${n.data.quote_request_id}`
    if (n.data?.booking_id) {
      return activeRole === 'provider' ? `/provider/bookings/${n.data.booking_id}` : `/bookings/${n.data.booking_id}`
    }
    return null
  }

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
              const href = notificationHref(n)
              const { icon: Icon, classes } = NOTIF_ICONS[n.notification_type] ?? { icon: Bell, classes: 'bg-gray-100 text-gray-500' }
              const inner = (
                <div className={'flex items-start gap-3 rounded-xl p-4 shadow-sm ring-1 transition ' + (n.is_read ? 'bg-white ring-gray-100' : 'bg-primary/[0.06] ring-primary/30')}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${classes}`}>
                    <Icon size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{n.title ?? n.notification_type?.replace(/_/g, ' ')}</p>
                    {n.body && <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>}
                    <p className="mt-1 text-xs text-gray-400">{formatDate(n.created_at)}</p>
                  </div>
                  {href && <span className="text-xs text-primary shrink-0">View →</span>}
                </div>
              )
              return href ? (
                <Link key={n.id} href={href}>{inner}</Link>
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

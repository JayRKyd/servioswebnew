import { Clock, CheckCircle, Play, Hourglass, XCircle, AlertCircle, Ban, Calendar, ShieldCheck } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-yellow-100 text-yellow-700',
  accepted:    'bg-primary/10 text-primary',
  in_progress: 'bg-primary/10 text-primary',
  completed:   'bg-green-100 text-green-700',
  cancelled:   'bg-gray-100 text-gray-500',
  rejected:    'bg-red-100 text-red-700',
  approved:    'bg-green-100 text-green-700',
  scheduled:   'bg-primary/10 text-primary',
  open:        'bg-red-100 text-red-700',
  resolved:    'bg-green-100 text-green-700',
  expired:     'bg-gray-100 text-gray-500',
  lost:        'bg-red-100 text-red-700',
  won:         'bg-green-100 text-green-700',
}

type IconComponent = React.ComponentType<{ className?: string; size?: number | string }>

const STATUS_ICONS: Record<string, IconComponent> = {
  pending:     Clock,
  accepted:    CheckCircle,
  in_progress: Play,
  completed:   CheckCircle,
  cancelled:   Ban,
  rejected:    XCircle,
  approved:    ShieldCheck,
  scheduled:   Calendar,
  open:        AlertCircle,
  resolved:    CheckCircle,
  expired:     Hourglass,
  lost:        XCircle,
  won:         CheckCircle,
}

export function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICONS[status] ?? AlertCircle
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'
  const label = status.replace(/_/g, ' ')

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colorClass}`}>
      <Icon size={11} />
      {label}
    </span>
  )
}

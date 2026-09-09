'use client'
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useContext, useEffect } from "react"
import { useNotifications } from "@/hooks/useNotifications"
import { useUnreadMessages } from "@/hooks/useUnreadMessages"
import type { Role } from "@/lib/permissions"
import { ROLE_ROUTES, SHARED_ROUTES } from "@/lib/permissions"
import { OnboardingContext } from "@/contexts/OnboardingContext"
import { ServiosMark } from "@/components/brand/Logo"
import {
  LayoutDashboard, Search, Wrench, CalendarDays, Clock,
  DollarSign, User, FileText, BarChart3, MessageSquare,
  Bell, Settings, HelpCircle, Star, BookOpen, Home,
  Users, ShieldCheck, AlertTriangle, Mail, Image,
  ClipboardList, Building2, FileCheck, Wallet, Quote,
  MapPin, Siren, CreditCard, CalendarPlus, Bookmark, ChevronDown
} from "lucide-react"

interface SidebarProps {
  role: Role
  /** Mobile drawer state — ignored at md and up where the sidebar is static */
  open?: boolean
  onClose?: () => void
}

const NAV_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/book": "Get Quotes",
  "/search": "Browse Providers",
  "/saved": "Saved",
  "/providers": "Providers",
  "/services": "Services",
  "/bookings": "Bookings",
  "/quotes": "My Quotes",
  "/reviews": "Reviews",
  "/provider": "Dashboard",
  "/provider/bookings": "Requests",
  "/provider/calendar": "Calendar",
  "/provider/availability": "Availability",
  "/provider/earnings": "Earnings",
  "/provider/profile": "Profile",
  "/provider/documents": "Documents",
  "/provider/services": "My Services",
  "/provider/analytics": "Analytics",
  "/provider/quotes": "Quote Requests",
  "/provider/payouts": "Payouts",
  "/provider/reviews": "Reviews",
  "/landlord": "Dashboard",
  "/landlord/properties": "Properties",
  "/landlord/tenants": "Tenants",
  "/landlord/maintenance": "Maintenance",
  "/landlord/providers": "Providers",
  "/landlord/bookings": "Bookings",
  "/landlord/compliance": "Compliance",
  "/landlord/analytics": "Analytics",
  "/landlord/quotes": "Get Quotes",
  "/landlord/emergency": "Emergency SOS",
  "/landlord/settings": "Settings",
  "/tenant": "Dashboard",
  "/tenant/property": "My Property",
  "/tenant/chat": "Chat Landlord",
  "/tenant/maintenance": "Maintenance",
  "/tenant/emergency": "Emergency",
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/providers": "Providers",
  "/admin/landlords": "Landlords",
  "/admin/bookings": "Bookings",
  "/admin/disputes": "Disputes",
  "/admin/compliance": "Compliance",
  "/admin/invitations": "Invitations",
  "/admin/analytics": "Analytics",
  "/admin/content": "Content Queue",
  "/admin/claims": "Claims",
  "/admin/settings": "Settings",
  "/messages": "Messages",
  "/notifications": "Notifications",
  "/settings": "Settings",
  "/help": "Help",
}

const NAV_ICONS: Record<string, React.ElementType> = {
  "Dashboard":      LayoutDashboard,
  "Get Quotes": CalendarPlus,
  "Browse Providers": Search,
  "Saved":          Bookmark,
  "Services":       Wrench,
  "Bookings":       BookOpen,
  "Requests":       BookOpen,
  "Reviews":        Star,
  "Calendar":       CalendarDays,
  "Availability":   Clock,
  "Earnings":       DollarSign,
  "Payouts":        Wallet,
  "Profile":        User,
  "Documents":      FileText,
  "My Services":    Wrench,
  "Analytics":      BarChart3,
  "Quote Requests": Quote,
  "My Quotes":      Quote,
  "Get Quotes":     Quote,
  "Properties":     Home,
  "Tenants":        Users,
  "Maintenance":    Wrench,
  "Providers":      ShieldCheck,
  "Compliance":     FileCheck,
  "Settings":       Settings,
  "Emergency SOS":  Siren,
  "Emergency":      Siren,
  "My Property":    MapPin,
  "Chat Landlord":  MessageSquare,
  "Users":          Users,
  "Landlords":      Building2,
  "Disputes":       AlertTriangle,
  "Invitations":    Mail,
  "Content Queue":  Image,
  "Claims":         ClipboardList,
  "Messages":       MessageSquare,
  "Notifications":  Bell,
  "Help":           HelpCircle,
}

const ROLE_LABEL: Record<Role, string> = {
  customer: "Customer",
  provider: "Service Provider",
  landlord: "Landlord",
  tenant:   "Tenant",
  admin:    "Admin",
}

const PROVIDER_SETUP_ROUTES = new Set(['/provider/setup/trade', '/provider/setup/services', '/provider/setup/availability', '/provider/setup/documents', '/provider/setup/complete'])

// Design item 27 — providers get five groups instead of a 16-item flat rail.
// Same grouping drives the mobile bottom tab bar.
export const PROVIDER_NAV_GROUPS: { label: string; route?: string; children?: string[] }[] = [
  { label: 'Home', route: '/provider' },
  { label: 'Jobs', children: ['/provider/bookings', '/provider/calendar', '/provider/availability'] },
  { label: 'Quotes', route: '/provider/quotes' },
  { label: 'Messages', route: '/messages' },
  { label: 'Business', children: ['/provider/earnings', '/provider/payouts', '/provider/analytics', '/provider/profile', '/provider/services', '/provider/documents', '/provider/reviews'] },
]
const PROVIDER_SECONDARY = ['/notifications', '/settings', '/help']
export const GROUP_ICONS: Record<string, React.ElementType> = {
  Home: LayoutDashboard,
  Jobs: CalendarDays,
  Quotes: Quote,
  Messages: MessageSquare,
  Business: BarChart3,
}
// Routes that stay accessible but don't appear in the nav: /providers is
// reached from cards/links, /services is a legacy catalog superseded by
// Get Quotes (deep links still work).
const NAV_HIDDEN = new Set(['/providers', '/services'])

export function Sidebar({ role, open = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const routes = [...ROLE_ROUTES[role], ...SHARED_ROUTES].filter(r => !NAV_HIDDEN.has(r))
  const onboarding = useContext(OnboardingContext)
  const isProvider = role === 'provider'
  const onboardingLocked = isProvider && !onboarding.complete
  const { unreadCount } = useNotifications()
  const { unreadCount: unreadMessages } = useUnreadMessages()

  // Grouped provider nav: the group containing the current page starts (and
  // stays) expanded; users can toggle others
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() =>
    PROVIDER_NAV_GROUPS.find(g => g.children?.some(r => pathname === r || pathname.startsWith(r + '/')))?.label ?? null
  )

  // Navigating closes the mobile drawer and expands the destination's group
  useEffect(() => {
    onClose?.()
    const owning = PROVIDER_NAV_GROUPS.find(g => g.children?.some(r => pathname === r || pathname.startsWith(r + '/')))?.label
    if (owning) setExpandedGroup(owning)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function isActive(route: string) {
    if (route === "/dashboard" || route === "/provider" || route === "/landlord" || route === "/tenant" || route === "/admin") {
      return pathname === route
    }
    return pathname === route || pathname.startsWith(route + "/")
  }

  function isLocked(route: string) {
    if (!onboardingLocked) return false
    return !PROVIDER_SETUP_ROUTES.has(route) && route !== '/messages' && route !== '/notifications' && route !== '/settings' && route !== '/help'
  }

  /** One nav entry — shared by the flat list, provider groups and secondary
   *  items. Icon null = nested child (indent line carries the hierarchy). */
  function renderItem(route: string, label: string, Icon: React.ElementType | null) {
    const active = isActive(route)
    const locked = isLocked(route)

    if (locked) {
      return (
        <span
          title="Complete setup to unlock"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] text-gray-300 cursor-not-allowed select-none"
        >
          {Icon && <Icon size={15} className="shrink-0" />}
          {label}
        </span>
      )
    }

    return (
      <Link
        href={route}
        className={
          "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-all " +
          (active
            ? "bg-primary/[0.08] text-primary font-semibold"
            : "text-muted hover:bg-white hover:text-dark hover:shadow-sm")
        }
      >
        {Icon && <Icon size={15} className="shrink-0" />}
        <span className="flex-1">{label}</span>
        {route === '/notifications' && unreadCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {route === '/messages' && unreadMessages > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadMessages > 9 ? '9+' : unreadMessages}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-[#fafbfa] " +
          "transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-none " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
      >
      {/* Logo */}
      <div className="flex h-[64px] items-center gap-2 px-5 border-b border-border shrink-0">
        <ServiosMark size={26} />
        <span className="text-[16px] font-semibold text-[#171717] tracking-[-0.02em]">servios</span>
      </div>

      {/* Role badge */}
      <div className="px-4 pt-4 pb-2">
        <span className="inline-flex items-center gap-1.5 bg-primary/[0.07] text-primary text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md">
          {ROLE_LABEL[role]}
        </span>
      </div>

      {/* Onboarding banner */}
      {onboardingLocked && (
        <div className="mx-3 mb-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-700">Setup required</p>
          <Link href={`/provider/setup/${onboarding.step}`} className="text-[11px] text-amber-600 hover:underline">
            Complete your profile →
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {isProvider ? (
          <ul className="space-y-0.5">
            {PROVIDER_NAV_GROUPS.map((group) => {
              const Icon = GROUP_ICONS[group.label] ?? LayoutDashboard

              // Single-route groups render as plain links
              if (group.route) {
                return <li key={group.label}>{renderItem(group.route, group.label, Icon)}</li>
              }

              const children = group.children ?? []
              const groupActive = children.some(isActive)
              const expanded = expandedGroup === group.label
              const groupLocked = onboardingLocked

              return (
                <li key={group.label}>
                  <button
                    onClick={() => !groupLocked && setExpandedGroup(e => (e === group.label ? null : group.label))}
                    className={
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-all " +
                      (groupLocked
                        ? "text-gray-300 cursor-not-allowed"
                        : groupActive
                          ? "text-primary font-semibold"
                          : "text-muted hover:bg-white hover:text-dark hover:shadow-sm")
                    }
                  >
                    <Icon size={15} className="shrink-0" />
                    <span className="flex-1 text-left">{group.label}</span>
                    <ChevronDown size={13} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && !groupLocked && (
                    <ul className="ml-[1.35rem] space-y-0.5 border-l border-gray-200 pl-2 pt-0.5">
                      {children.map((route) => (
                        <li key={route}>{renderItem(route, NAV_LABELS[route] ?? route, null)}</li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}

            <li className="pt-3">
              <div className="mb-1 border-t border-gray-200/70" />
            </li>
            {PROVIDER_SECONDARY.map((route) => {
              const label = NAV_LABELS[route] ?? route
              const Icon = NAV_ICONS[label] ?? LayoutDashboard
              return <li key={route}>{renderItem(route, label, Icon)}</li>
            })}
          </ul>
        ) : (
          <ul className="space-y-0.5">
            {routes.map((route) => {
              const label = NAV_LABELS[route] ?? route
              const Icon = NAV_ICONS[label] ?? LayoutDashboard
              return <li key={route}>{renderItem(route, label, Icon)}</li>
            })}
          </ul>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <p className="text-[11px] text-muted/60 capitalize">Signed in as {role}</p>
      </div>
      </aside>
    </>
  )
}

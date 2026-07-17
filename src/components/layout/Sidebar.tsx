'use client'
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useContext } from "react"
import { useNotifications } from "@/hooks/useNotifications"
import { useUnreadMessages } from "@/hooks/useUnreadMessages"
import type { Role } from "@/lib/permissions"
import { ROLE_ROUTES, SHARED_ROUTES } from "@/lib/permissions"
import { OnboardingContext } from "@/contexts/OnboardingContext"
import {
  LayoutDashboard, Search, Wrench, CalendarDays, Clock,
  DollarSign, User, FileText, BarChart3, MessageSquare,
  Bell, Settings, HelpCircle, Star, BookOpen, Home,
  Users, ShieldCheck, AlertTriangle, Mail, Image,
  ClipboardList, Building2, FileCheck, Wallet, Quote,
  MapPin, Siren, CreditCard, CalendarPlus, Bookmark
} from "lucide-react"

interface SidebarProps { role: Role }

const NAV_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/book": "Get Quotes",
  "/search": "Browse Providers",
  "/saved": "Saved",
  "/providers": "Providers",
  "/services": "Services",
  "/bookings": "Bookings",
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

const PROVIDER_SETUP_ROUTES = new Set(['/provider/setup/trade', '/provider/setup/services', '/provider/setup/documents', '/provider/setup/complete'])
// Routes that stay accessible but don't appear in the nav: /providers is
// reached from cards/links, /services is a legacy catalog superseded by
// Get Quotes (deep links still work).
const NAV_HIDDEN = new Set(['/providers', '/services'])

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()
  const routes = [...ROLE_ROUTES[role], ...SHARED_ROUTES].filter(r => !NAV_HIDDEN.has(r))
  const onboarding = useContext(OnboardingContext)
  const isProvider = role === 'provider'
  const onboardingLocked = isProvider && !onboarding.complete
  const { unreadCount } = useNotifications()
  const { unreadCount: unreadMessages } = useUnreadMessages()

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

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-border bg-[#fafbfa]">
      {/* Logo */}
      <div className="flex h-[64px] items-center gap-2.5 px-5 border-b border-border shrink-0">
        <div className="relative w-7 h-7 shrink-0">
          <div className="absolute inset-0 bg-primary rounded-lg" />
          <svg className="relative" width="28" height="28" viewBox="0 0 32 32" fill="none">
            <path d="M10 20.5c0-2.5 3-4.5 6-4.5s6 2 6 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="12" r="3.5" stroke="white" strokeWidth="2" />
          </svg>
        </div>
        <span className="text-[16px] font-semibold text-dark tracking-[-0.02em]">Servios</span>
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
        <ul className="space-y-0.5">
          {routes.map((route) => {
            const label = NAV_LABELS[route] ?? route
            const Icon = NAV_ICONS[label] ?? LayoutDashboard
            const active = isActive(route)
            const locked = isLocked(route)

            return (
              <li key={route}>
                {locked ? (
                  <span
                    title="Complete setup to unlock"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] text-gray-300 cursor-not-allowed select-none"
                  >
                    <Icon size={15} className="shrink-0" />
                    {label}
                  </span>
                ) : (
                  <Link
                    href={route}
                    className={
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-all " +
                      (active
                        ? "bg-primary/[0.08] text-primary font-semibold"
                        : "text-muted hover:bg-white hover:text-dark hover:shadow-sm")
                    }
                  >
                    <Icon size={15} className="shrink-0" />
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
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <p className="text-[11px] text-muted/60 capitalize">Signed in as {role}</p>
      </div>
    </aside>
  )
}

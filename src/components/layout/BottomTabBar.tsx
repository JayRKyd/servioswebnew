'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUnreadMessages } from '@/hooks/useUnreadMessages'
import { GROUP_ICONS, PROVIDER_NAV_GROUPS } from '@/components/layout/Sidebar'

/** Mobile bottom tab bar for providers (design item 27) — tradespeople live
 *  on their phones, and the five nav groups belong under the thumb, not
 *  behind a hamburger. The drawer stays for the long tail. */
const TABS = PROVIDER_NAV_GROUPS.map(g => ({
  label: g.label,
  // Group tabs land on their primary child
  href: g.route ?? g.children![0],
  routes: g.route ? [g.route] : g.children!,
}))

export function BottomTabBar() {
  const pathname = usePathname()
  const { unreadCount: unreadMessages } = useUnreadMessages()

  function isActive(tab: (typeof TABS)[number]) {
    return tab.routes.some(r => (r === '/provider' ? pathname === r : pathname === r || pathname.startsWith(r + '/')))
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map(tab => {
        const Icon = GROUP_ICONS[tab.label]
        const active = isActive(tab)
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={
              'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ' +
              (active ? 'text-primary' : 'text-muted hover:text-dark')
            }
          >
            <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
            {tab.label}
            {tab.label === 'Messages' && unreadMessages > 0 && (
              <span className="absolute right-[calc(50%-16px)] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

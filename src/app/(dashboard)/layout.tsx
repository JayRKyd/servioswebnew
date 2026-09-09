'use client'
import { Suspense, useState } from "react"
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import Navbar from "@/components/public/Navbar"
import { VerifiedBanner } from "@/components/shared/VerifiedBanner"
import { useActiveRole } from "@/hooks/useActiveRole"
import { useAuthContext } from "@/components/providers/AuthProvider"
import { MessagesRealtimeProvider } from "@/components/providers/MessagesRealtimeProvider"
import { OnboardingProvider } from "@/components/providers/OnboardingProvider"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthContext()
  const { activeRole } = useActiveRole()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Show a lightweight skeleton while auth resolves from localStorage.
  // This is typically <50ms — just long enough to avoid a flash of the wrong role.
  if (isLoading) return (
    <div className="flex h-screen bg-[#fafbfa]">
      {/* Skeleton sidebar */}
      <aside className="hidden md:flex h-screen w-[220px] shrink-0 flex-col border-r border-gray-100 bg-[#fafbfa]">
        <div className="flex h-[64px] items-center gap-2.5 px-5 border-b border-gray-100">
          <div className="h-7 w-7 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-4 w-16 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="px-4 pt-4 pb-2">
          <div className="h-5 w-20 rounded bg-gray-200 animate-pulse" />
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </nav>
      </aside>
      {/* Skeleton main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="h-[64px] shrink-0 border-b border-gray-100 bg-white" />
        <main className="flex-1 overflow-y-auto bg-[#f7f8f7] p-6 lg:p-8">
          <div className="space-y-4">
            <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-32 rounded-xl bg-gray-200 animate-pulse" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )

  // Visitors browsing the public funnel (search, profiles, Get Quotes — the
  // middleware only lets those through) get the marketing shell instead of
  // the app chrome; booking or messaging bounces them to login.
  if (!user) {
    return (
      <div className="min-h-screen bg-[#f7f8f7]">
        <Navbar />
        <main className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8 pt-[96px] pb-12">
          {children}
        </main>
      </div>
    )
  }

  return (
    <MessagesRealtimeProvider>
      <OnboardingProvider isProvider={activeRole === 'provider'}>
        <div className="flex h-screen">
          <Sidebar role={activeRole} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto bg-[#f7f8f7] p-4 sm:p-6 lg:p-8">
              <Suspense fallback={null}><VerifiedBanner /></Suspense>
              {children}
            </main>
          </div>
        </div>
      </OnboardingProvider>
    </MessagesRealtimeProvider>
  )
}

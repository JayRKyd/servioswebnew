'use client'
import { Header } from "@/components/layout/Header"
import { Sidebar } from "@/components/layout/Sidebar"
import { useActiveRole } from "@/hooks/useActiveRole"
import { useAuthContext } from "@/components/providers/AuthProvider"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuthContext()
  const { activeRole } = useActiveRole()

  // Show a lightweight skeleton while auth resolves from localStorage.
  // This is typically <50ms — just long enough to avoid a flash of the wrong role.
  if (isLoading) return (
    <div className="flex h-screen bg-[#fafbfa]">
      {/* Skeleton sidebar */}
      <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-gray-100 bg-[#fafbfa]">
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

  return (
    <div className="flex h-screen">
      <Sidebar role={activeRole} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-[#f7f8f7] p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

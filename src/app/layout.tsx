import type { Metadata } from 'next'
import "@/styles/tailwind.css"
import "@/app/globals.css"
import { AuthProvider } from '@/components/providers/AuthProvider'
import { RoleProvider } from '@/components/providers/RoleProvider'

export const metadata: Metadata = {
  title: 'Servios',
  description: 'Find trusted local professionals across the UK',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <RoleProvider>
            {children}
          </RoleProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

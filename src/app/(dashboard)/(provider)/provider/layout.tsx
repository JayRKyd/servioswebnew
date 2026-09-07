import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Provider hub' }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}

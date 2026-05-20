'use client'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail } from 'lucide-react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  return (
    <div className="min-h-screen bg-[#fafbfa] flex flex-col items-center justify-center px-5 py-16">
    <div className="w-full max-w-sm space-y-6 text-center">
      {/* Icon */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Mail size={28} className="text-primary" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Check your inbox</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          We sent a confirmation link to
          {email ? (
            <> <span className="font-semibold text-gray-700">{email}</span></>
          ) : (
            ' your email address'
          )}.
          Click the link to activate your account.
        </p>
      </div>

      <div className="rounded-xl bg-amber-50 px-4 py-3 text-left ring-1 ring-amber-200">
        <p className="text-xs font-semibold text-amber-800 mb-1">Didn&apos;t receive it?</p>
        <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
          <li>Check your spam or junk folder</li>
          <li>Make sure the email address above is correct</li>
          <li>Allow a minute or two for delivery</li>
        </ul>
      </div>

      <p className="text-xs text-gray-400">
        The link expires after 24 hours. If it has expired,{' '}
        <Link href="/signup" className="text-primary hover:underline font-medium">
          sign up again
        </Link>
        .
      </p>

      <Link
        href="/login"
        className="block text-sm font-medium text-primary hover:underline"
      >
        ← Back to sign in
      </Link>
    </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  )
}

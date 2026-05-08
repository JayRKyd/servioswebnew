import Link from 'next/link'

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-sm space-y-4 text-center">
      <h1 className="text-2xl font-bold">Verify your email</h1>
      <p className="text-sm text-gray-500">
        We sent a confirmation link to your email address. Click the link to activate your account.
      </p>
      <p className="text-xs text-gray-400">
        Didn&apos;t receive it? Check your spam folder.
      </p>
      <Link href="/login" className="block text-sm text-blue-600 hover:underline">
        Back to sign in
      </Link>
    </div>
  )
}

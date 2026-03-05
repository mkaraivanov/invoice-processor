import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/services/auth.service'
import { SignOutButton } from '@/components/SignOutButton'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  try {
    const user = await authService.getUser()
    if (!user) redirect('/login')
  } catch {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="font-semibold text-lg">Invoice Processor</Link>
          <div className="flex gap-4 items-center">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</Link>
            <Link href="/invoices" className="text-sm text-gray-600 hover:text-gray-900">Invoices</Link>
            <SignOutButton />
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}

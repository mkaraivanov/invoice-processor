# Phase 8: UI Pages & Components

## Goal
Implement all Next.js pages: root layout, home redirect, auth pages (login/register), protected layout, dashboard, invoice list, and invoice detail.

---

## 8.1 Add shadcn components

```bash
npx shadcn@latest add button card input label form table badge toast
```

Installs to `src/components/ui/`.

---

## 8.2 `src/app/layout.tsx`

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Invoice Processor',
  description: 'Upload and process invoices with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

---

## 8.3 `src/app/page.tsx`

```typescript
import { redirect } from 'next/navigation'
import { authService } from '@/services/auth.service'

export default async function Home() {
  try {
    const user = await authService.getUser()
    if (user) {
      redirect('/dashboard')
    }
  } catch {
    // User not authenticated
  }

  redirect('/login')
}
```

Redirects authenticated users to dashboard, unauthenticated to login.

---

## 8.4 `src/app/(auth)/login/page.tsx`

Client Component. Uses `createClient()` (browser client) to call `supabase.auth.signInWithPassword` directly. On success, redirects to `/dashboard`.

Key elements:
- `'use client'`
- Email + password fields
- Error display
- Loading state on button
- Link to `/register`

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your credentials to log in</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          <p className="text-center text-sm text-gray-600 mt-4">
            Don't have an account?{' '}
            <Link href="/register" className="text-blue-600 hover:underline">Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## 8.5 `src/app/(auth)/register/page.tsx`

Client Component. Calls `supabase.auth.signUp` with email, password, and `options.data.full_name`. On success, redirects to `/dashboard`.

Key elements:
- `'use client'`
- Full name (optional), email, password fields
- Client-side validation: password min 8 chars
- Error display
- Link to `/login`

---

## 8.6 `src/app/(protected)/layout.tsx`

Server Component. Checks auth and redirects to `/login` if no user. Renders nav bar with links to Dashboard and Invoices, plus a Sign Out form action.

```typescript
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { authService } from '@/services/auth.service'
import { Button } from '@/components/ui/button'

async function SignOutButton() {
  'use client'
  return (
    <form action={async () => {
      'use server'
      await authService.signOut()
      redirect('/login')
    }}>
      <Button variant="outline" type="submit">Sign Out</Button>
    </form>
  )
}

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
```

---

## 8.7 `src/app/(protected)/dashboard/page.tsx`

Client Component. Fetches `GET /api/invoices` on mount and displays 4 stat cards: Total, Pending, Completed, Failed.

---

## 8.8 `src/app/(protected)/invoices/page.tsx`

Client Component. Features:
- Lists invoices in a table (filename, status badge, upload date, View link)
- Hidden file input triggered by an Upload button
- `handleUpload` posts to `POST /api/invoices` with FormData
- Auto-refreshes every 10s while invoices are pending/processing
- Error display for upload failures

---

## 8.9 `src/app/(protected)/invoices/[id]/page.tsx`

Client Component. Uses `useParams()` for the invoice ID. Features:
- Fetches `GET /api/invoices/[id]` every 5s while status is PENDING/PROCESSING
- Shows status badge and timestamps
- Yellow card while PENDING/PROCESSING
- Red card on FAILED with error message
- Extracted data card on COMPLETED (vendor, amount, date, line items table)
- Download button (placeholder)
- Back to Invoices button

---

## Checklist
- [ ] shadcn components installed (button, card, input, label, badge, toast)
- [ ] Root layout renders without errors
- [ ] `src/app/page.tsx` redirects correctly
- [ ] Login page: form submits, errors display, redirects on success
- [ ] Register page: form submits, client validation works
- [ ] Protected layout: redirects unauthenticated users to `/login`
- [ ] Dashboard: stat cards render, fetches from `/api/invoices`
- [ ] Invoices list: upload works, table renders, polling active
- [ ] Invoice detail: status polling, extracted data display

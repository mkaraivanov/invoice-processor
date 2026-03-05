# Phase 6: Services Layer

## Goal
Implement Supabase clients (browser, server, middleware), shared types/schemas, and all three services: `auth.service.ts`, `storage.service.ts`, `invoice.service.ts`.

**Rules** (from `.claude/rules/services.md`):
- Use repositories — never import Prisma directly
- Enforce auth check at the start of every data-access method
- Verify resource ownership before any read/write
- Use Zod schemas for input validation

---

## 6.1 `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

Used in Client Components.

---

## 6.2 `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = async () => {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

Used in Server Components and Route Handlers. Note: `cookies()` is awaited (Next.js 15 requirement).

---

## 6.3 `src/lib/supabase/middleware.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set on request first so refreshed token is visible within this request cycle
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from protected routes
  if (
    !user &&
    (request.nextUrl.pathname.startsWith('/dashboard') ||
      request.nextUrl.pathname.startsWith('/invoices'))
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth routes
  if (
    user &&
    (request.nextUrl.pathname === '/login' ||
      request.nextUrl.pathname === '/register')
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
```

**Critical**: `setAll` must set cookies on **both** request AND response.

---

## 6.4 `src/types/index.ts`

```typescript
import { z } from 'zod'

// Validation schemas
export const uploadInvoiceSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (file) => ['application/pdf', 'image/png', 'image/jpeg'].includes(file.type),
      'File must be PDF, PNG, or JPG'
    )
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File must be smaller than 10MB'),
})

export const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().optional(),
})

export const signInSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string(),
})

// DTOs
export type UploadInvoiceInput = z.infer<typeof uploadInvoiceSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type SignInInput = z.infer<typeof signInSchema>

export interface ExtractedInvoiceData {
  vendor?: string
  amount?: number
  date?: string
  lineItems?: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
}
```

---

## 6.5 `src/services/auth.service.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { userRepository } from '@/repositories/user.repository'
import { CreateUserInput, SignInInput } from '@/types'

export const authService = {
  async signUp(input: CreateUserInput) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    })

    if (error) throw new Error(`Sign-up failed: ${error.message}`)

    // Sync user to app DB
    if (data.user) {
      await userRepository.upsert(
        data.user.id,
        data.user.email!,
        input.fullName
      )
    }

    return data
  },

  async signIn(input: SignInInput) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    })

    if (error) throw new Error(`Sign-in failed: ${error.message}`)

    return data
  },

  async signOut() {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) throw new Error(`Sign-out failed: ${error.message}`)
  },

  async getUser() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) throw new Error(`Failed to get user: ${error.message}`)

    return user
  },
}
```

---

## 6.6 `src/services/storage.service.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export const storageService = {
  async uploadInvoiceFile(userId: string, file: File) {
    const supabase = await createClient()

    // Generate safe filename
    const ext = file.name.split('.').pop()
    const fileName = `${userId}/${uuidv4()}.${ext}`

    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(fileName, file)

    if (error) throw new Error(`Storage upload failed: ${error.message}`)

    return data.path
  },

  async getSignedUrl(path: string, expiresIn = 3600) {
    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(path, expiresIn)

    if (error) throw new Error(`Failed to generate signed URL: ${error.message}`)

    return data.signedUrl
  },

  async deleteFile(path: string) {
    const supabase = await createClient()
    const { error } = await supabase.storage
      .from('invoices')
      .remove([path])

    if (error) throw new Error(`Storage delete failed: ${error.message}`)
  },
}
```

---

## 6.7 `src/services/invoice.service.ts`

```typescript
import { invoiceRepository } from '@/repositories/invoice.repository'
import { storageService } from '@/services/storage.service'
import { uploadInvoiceSchema, type UploadInvoiceInput, type ExtractedInvoiceData } from '@/types'

export const invoiceService = {
  async uploadInvoice(userId: string, input: UploadInvoiceInput) {
    uploadInvoiceSchema.parse(input)

    const fileUrl = await storageService.uploadInvoiceFile(userId, input.file)

    const invoice = await invoiceRepository.create({
      userId,
      fileName: input.file.name,
      fileUrl,
    })

    return invoice
  },

  async getUserInvoices(userId: string) {
    return invoiceRepository.findByUserId(userId)
  },

  async getInvoice(invoiceId: string, userId: string) {
    const invoice = await invoiceRepository.findById(invoiceId)

    if (!invoice) throw new Error('Invoice not found')
    if (invoice.userId !== userId) throw new Error('Unauthorized')

    return invoice
  },

  async processInvoice(invoiceId: string) {
    const invoice = await invoiceRepository.findById(invoiceId)
    if (!invoice) throw new Error('Invoice not found')

    try {
      await invoiceRepository.updateStatus(invoiceId, 'PROCESSING')

      // Simulate AI processing (replace with real AI call later)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const extractedData: ExtractedInvoiceData = {
        vendor: 'Acme Corp',
        amount: 1250.99,
        date: new Date().toISOString().split('T')[0],
        lineItems: [
          { description: 'Widget A', quantity: 10, unitPrice: 100, total: 1000 },
          { description: 'Service Fee', quantity: 1, unitPrice: 250.99, total: 250.99 },
        ],
      }

      await invoiceRepository.updateStatus(invoiceId, 'COMPLETED', extractedData)

      return { invoiceId, status: 'COMPLETED', data: extractedData }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await invoiceRepository.updateStatus(invoiceId, 'FAILED', undefined, errorMessage)
      throw error
    }
  },

  async processPendingInvoices() {
    const pendingInvoices = await invoiceRepository.findPending(5)

    const results = []
    for (const invoice of pendingInvoices) {
      try {
        const result = await this.processInvoice(invoice.id)
        results.push(result)
      } catch (error) {
        console.error(`Failed to process invoice ${invoice.id}:`, error)
      }
    }

    return { processed: results.length, results }
  },
}
```

**`processInvoice` is mocked** — 2s sleep, returns dummy data. Replace with real AI later.

---

## Checklist
- [ ] `src/lib/supabase/client.ts` uses `createBrowserClient`
- [ ] `src/lib/supabase/server.ts` awaits `cookies()`
- [ ] `src/lib/supabase/middleware.ts` sets cookies on both request AND response
- [ ] `src/types/index.ts` exports Zod schemas and TypeScript types
- [ ] `authService` syncs user to app DB on sign-up
- [ ] `storageService` generates `{userId}/{uuid}.{ext}` file paths
- [ ] `invoiceService.getInvoice` verifies ownership (userId check)
- [ ] Services import repositories, not Prisma directly

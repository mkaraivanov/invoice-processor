# Invoice Processor POC — Implementation Plan

**Last Updated**: March 3, 2026

## Overview

A greenfield **Next.js 15** App Router project with Supabase (Auth + Storage + Postgres), Prisma (with repository layer), shadcn/ui, and Vercel deployment. Users register, upload invoices (PDFs/images), metadata is stored in Postgres, and a Vercel cron job picks up pending invoices for background processing (mocked AI for now). The 10s Vercel Hobby timeout is handled via async polling — uploads return immediately, processing happens in cron.

### Key Architectural Decisions

- **`@supabase/ssr`** (not the deprecated `auth-helpers-nextjs`)
- **Prisma bypasses Supabase RLS** — all access control enforced in application code (services layer)
- **Repository layer** retained per preference (mirrors .NET patterns); each repo wraps Prisma calls
- **No Supabase Edge Functions** in POC scope — cron-based async is simpler
- **shadcn/ui + Tailwind CSS** for UI
- **npm** as package manager

---

## Phase 1: Project Scaffolding

### 1.1 Initialize Next.js project

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Answers: 
- TypeScript: Yes
- ESLint: Yes
- App Router: Yes
- Tailwind CSS: Yes
- Turbopack: No
- Import alias: `@/*`

This creates [src/app/](src/app/) with App Router structure.

> **Next.js 15 note**: Several Request APIs are now asynchronous — `cookies()` must be awaited (already accounted for in `server.ts`). For any **Server Component** receiving dynamic route params, `params` must be typed as `Promise<{ id: string }>` and awaited before use. Client Components using `useParams()` are unaffected.

### 1.2 Initialize shadcn/ui

```bash
npx shadcn@latest init
```

- Style: "New York"
- Base color: slate
- CSS variables: Yes

This configures [components.json](components.json) and [src/lib/utils.ts](src/lib/utils.ts).

Verify/update [components.json](components.json) includes the `hooks` alias (shadcn CLI generates this by default in current versions):

```json
{
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### 1.3 Install core dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install prisma --save-dev && npm install @prisma/client @prisma/adapter-pg
npm install zod
npm install lucide-react
```

- `@supabase/supabase-js` — Supabase client library
- `@supabase/ssr` — Auth helpers for server/middleware
- `prisma` — ORM CLI
- `@prisma/client` — ORM runtime
- `@prisma/adapter-pg` — Driver adapter required by Prisma v6+ for pg connections
- `zod` — Input validation
- `lucide-react` — Icons

### 1.4 Initialize Prisma

```bash
npx prisma init
```

Creates [prisma/schema.prisma](prisma/schema.prisma) and adds `DATABASE_URL` to `.env`.

### 1.5 Create [.env.local](.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Server-only (never expose to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Prisma (use pooled connection from PgBouncer)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:6543/postgres?schema=public
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?schema=public

# Cron security
CRON_SECRET=your-random-secret-key-here
```

**Important**:
- `DATABASE_URL` uses port 6543 (PgBouncer) for connection pooling — safe for serverless
- `DIRECT_URL` uses port 5432 (direct) for Prisma migrations — do not use in API routes
- `NEXT_PUBLIC_*` vars are exposed to browser (safe: URL and anon key are public by design)
- `SUPABASE_SERVICE_ROLE_KEY` never commits to repo

---

## Phase 2: Project Structure

```
invoice-processor/
├── src/
│   ├── app/
│   │   ├── generated/
│   │   │   └── prisma/              # Prisma-generated client (output path)
│   │   ├── layout.tsx               # Root layout (font, providers)
│   │   ├── page.tsx                  # Landing / redirect to dashboard
│   │   ├── (auth)/                   # Route group — no layout nesting
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (protected)/              # Route group — auth-checked layout
│   │   │   ├── layout.tsx            # Server check: redirect if no session
│   │   │   ├── dashboard/page.tsx
│   │   │   └── invoices/
│   │   │       ├── page.tsx          # Invoice list
│   │   │       └── [id]/page.tsx     # Invoice detail
│   │   └── api/
│   │       ├── invoices/
│   │       │   └── route.ts          # POST upload, GET list
│   │       └── cron/
│   │           └── process-invoices/
│   │               └── route.ts      # Cron endpoint
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn components (auto-generated)
│   │   ├── invoice-upload-form.tsx
│   │   ├── invoice-list.tsx
│   │   ├── invoice-status-badge.tsx
│   │   └── auth/
│   │       ├── login-form.tsx
│   │       └── register-form.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # createBrowserClient()
│   │   │   ├── server.ts             # createServerClient() for RSC/Route Handlers
│   │   │   └── middleware.ts         # createServerClient() for middleware
│   │   ├── prisma.ts                 # Singleton PrismaClient
│   │   └── utils.ts                  # shadcn cn() utility
│   │
│   ├── services/
│   │   ├── auth.service.ts           # Sign up, sign in, sign out wrappers
│   │   ├── invoice.service.ts        # Upload, list, get, process orchestration
│   │   └── storage.service.ts        # File upload/download to Supabase Storage
│   │
│   ├── repositories/
│   │   ├── invoice.repository.ts     # CRUD via Prisma for Invoice model
│   │   └── user.repository.ts        # CRUD via Prisma for User model
│   │
│   ├── types/
│   │   └── index.ts                  # Shared types, Zod schemas, DTOs
│   │
│   └── utils/
│       └── constants.ts              # App-wide constants
│
├── prisma/
│   └── schema.prisma
│
├── middleware.ts                      # Next.js middleware (auth session refresh)
├── .env.local
├── next.config.js
├── vercel.json                        # Cron config
├── package.json
└── docs/
    └── IMPLEMENTATION_PLAN.md        # This file
```

### Key Changes from Original Notes

- **Route groups** `(auth)` and `(protected)` replace flat `login/` / `dashboard/` — idiomatic App Router for applying different layouts (protected layout checks session)
- **No `payment` module** — POC focuses on invoices only
- **`storage.service.ts`** added — abstracts Supabase Storage interactions
- **`middleware.ts`** at project root (not in `src/`) — Next.js requires this location
- **No `supabase/functions/`** — cron-based approach chosen for POC

---

## Phase 3: Database Schema (Prisma)

### 3.1 Create [prisma/schema.prisma](prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/app/generated/prisma"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id        String   @id(map: "users_pkey") @default(uuid())
  email     String   @unique
  fullName  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  invoices Invoice[]

  @@map("users")
}

model Invoice {
  id              String          @id @default(uuid())
  userId          String
  fileName        String
  fileUrl         String
  status          InvoiceStatus   @default(PENDING)
  extractedData   Json?
  errorMessage    String?
  uploadedAt      DateTime        @default(now())
  processedAt     DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@map("invoices")
}

enum InvoiceStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

**Schema Notes**:
- `User.id` maps to Supabase `auth.users.id` (UUID)
- `Invoice.status` defaults to `PENDING`
- `Invoice.extractedData` is `Json` for flexible parsed invoice fields
- Indexes on `userId` and `status` for fast lookups during processing
- Cascade delete: deleting a user deletes their invoices

### 3.2 Run initial migration

```bash
npx prisma migrate dev --name init
```

Creates [prisma/migrations/](prisma/migrations/) folder with migration SQL.

### 3.3 Generate Prisma client

```bash
npx prisma generate
```

Generates the Prisma client to `src/app/generated/prisma/` (run automatically after migrations, but explicit for clarity). Import from `@/app/generated/prisma/client` — **not** `@prisma/client`.

### 3.4 Verify schema

```bash
npx prisma studio
```

Opens a Prisma Studio UI to inspect/edit records locally.

---

## Phase 4: Supabase Setup

### 4.1 Create Supabase project

1. Visit [supabase.com](https://supabase.com)
2. Create a new project (note the organization, project name, region)
3. Retrieve from project settings:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** (public, client-side) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** (secret, server-only) → `SUPABASE_SERVICE_ROLE_KEY`
4. In "Database" settings, retrieve Postgres connection string:
   - **Pooled connection** (PgBouncer, port 6543) → `DATABASE_URL`
   - **Direct connection** (port 5432) → `DIRECT_URL`

### 4.2 Sync Postgres schema from Prisma

The Prisma migration (phase 3.2) creates tables in the Supabase Postgres database directly — no extra Supabase setup needed for tables.

### 4.3 Create Storage bucket

1. Go to Supabase dashboard → **Storage**
2. Click **Create Bucket** → name: `invoices`, **Private** (checked)
3. Click bucket → **Policies**
4. Add policy for authenticated users (RLS):

```sql
-- Allow users to upload to their own folder
CREATE POLICY "Allow authenticated to upload invoices"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own files
CREATE POLICY "Allow authenticated to read own invoices"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

This enforces that users can only upload/read files under their own `{userId}/` folder.

---

## Phase 5: Repository Layer

### 5.1 Create [src/lib/prisma.ts](src/lib/prisma.ts)

```typescript
import { PrismaClient } from "@/app/generated/prisma/client"  // ← custom output path; /client suffix required
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

Singleton pattern — prevents multiple PrismaClient instances in development. Uses the **driver adapter pattern** required by Prisma v6+.

### 5.2 Create [src/repositories/user.repository.ts](src/repositories/user.repository.ts)

```typescript
import { prisma } from '@/lib/prisma'

export const userRepository = {
  async upsert(id: string, email: string, fullName?: string) {
    return prisma.user.upsert({
      where: { id },
      create: { id, email, fullName },
      update: { email, fullName },
    })
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    })
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    })
  },
}
```

**Methods**:
- `upsert(id, email, fullName?)` — create or update user from Supabase Auth
- `findById(id)` — get user by ID
- `findByEmail(email)` — get user by email

### 5.3 Create [src/repositories/invoice.repository.ts](src/repositories/invoice.repository.ts)

```typescript
import { prisma } from '@/lib/prisma'
import { InvoiceStatus } from '@/app/generated/prisma/client'  // ← custom output path; not @prisma/client

export const invoiceRepository = {
  async create(data: {
    userId: string
    fileName: string
    fileUrl: string
  }) {
    return prisma.invoice.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    })
  },

  async findById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: { user: true },
    })
  },

  async findByUserId(userId: string, limit = 50) {
    return prisma.invoice.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
    })
  },

  async updateStatus(
    id: string,
    status: InvoiceStatus,
    extractedData?: Record<string, unknown>,
    errorMessage?: string
  ) {
    return prisma.invoice.update({
      where: { id },
      data: {
        status,
        extractedData,
        errorMessage,
        processedAt: ['COMPLETED', 'FAILED'].includes(status)
          ? new Date()
          : null,
      },
    })
  },

  async findPending(limit = 5) {
    return prisma.invoice.findMany({
      where: { status: 'PENDING' },
      orderBy: { uploadedAt: 'asc' },
      take: limit,
    })
  },

  async delete(id: string) {
    return prisma.invoice.delete({
      where: { id },
    })
  },
}
```

**Methods**:
- `create(data)` — insert new invoice row (status defaults to `PENDING`)
- `findById(id)` — get single invoice with user
- `findByUserId(userId, limit)` — list user's invoices
- `updateStatus(id, status, extractedData?, errorMessage?)` — update after processing, sets `processedAt` if done
- `findPending(limit)` — get pending invoices for cron
- `delete(id)` — remove invoice record

---

## Phase 6: Services Layer

### 6.1 Create [src/lib/supabase/client.ts](src/lib/supabase/client.ts)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

Use in Client Components to access Supabase Auth and Storage.

### 6.2 Create [src/lib/supabase/server.ts](src/lib/supabase/server.ts)

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

Use in Server Components, Route Handlers, and Server Actions to access Supabase without CORS issues.

### 6.3 Create [src/lib/supabase/middleware.ts](src/lib/supabase/middleware.ts)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Set on request first so the refreshed token is visible within this request cycle
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

Use in [middleware.ts](middleware.ts) to refresh session and guard routes.

### 6.4 Create [src/services/storage.service.ts](src/services/storage.service.ts)

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

**Methods**:
- `uploadInvoiceFile(userId, file)` — upload to `{userId}/{uuid}.{ext}`, return storage path
- `getSignedUrl(path, expiresIn)` — generate temporary download URL (default 1 hour)
- `deleteFile(path)` — remove file from storage

**Dependency**: `npm install uuid` for UUID generation.

### 6.5 Create [src/types/index.ts](src/types/index.ts)

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

### 6.6 Create [src/services/auth.service.ts](src/services/auth.service.ts)

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

### 6.7 Create [src/services/invoice.service.ts](src/services/invoice.service.ts)

```typescript
import { invoiceRepository } from '@/repositories/invoice.repository'
import { storageService } from '@/services/storage.service'
import { uploadInvoiceSchema, type UploadInvoiceInput, type ExtractedInvoiceData } from '@/types'

export const invoiceService = {
  async uploadInvoice(userId: string, input: UploadInvoiceInput) {
    // Validate input
    uploadInvoiceSchema.parse(input)

    // Upload file to storage
    const fileUrl = await storageService.uploadInvoiceFile(userId, input.file)

    // Create invoice record
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
      // Mark as processing
      await invoiceRepository.updateStatus(invoiceId, 'PROCESSING')

      // Simulate AI processing
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock extracted data (replace with real AI call later)
      const extractedData: ExtractedInvoiceData = {
        vendor: 'Acme Corp',
        amount: 1250.99,
        date: new Date().toISOString().split('T')[0],
        lineItems: [
          {
            description: 'Widget A',
            quantity: 10,
            unitPrice: 100,
            total: 1000,
          },
          {
            description: 'Service Fee',
            quantity: 1,
            unitPrice: 250.99,
            total: 250.99,
          },
        ],
      }

      // Mark as completed
      await invoiceRepository.updateStatus(
        invoiceId,
        'COMPLETED',
        extractedData
      )

      return { invoiceId, status: 'COMPLETED', data: extractedData }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await invoiceRepository.updateStatus(
        invoiceId,
        'FAILED',
        undefined,
        errorMessage
      )
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

    return {
      processed: results.length,
      results,
    }
  },
}
```

**Methods**:
- `uploadInvoice(userId, input)` — validate, upload file, create DB record, return invoice
- `getUserInvoices(userId)` — list user's invoices
- `getInvoice(invoiceId, userId)` — get single invoice with ownership check
- `processInvoice(invoiceId)` — **mocked**: 2s sleep, return dummy extracted data
- `processPendingInvoices()` — fetch pending (limit 5), process each, return results

---

## Phase 7: API Routes

### 7.1 Create [middleware.ts](middleware.ts) (project root)

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

Refreshes Supabase session and guards routes.

### 7.2 Create [src/app/api/invoices/route.ts](src/app/api/invoices/route.ts)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { invoiceService } from '@/services/invoice.service'

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const user = await authService.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Parse multipart form
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Upload invoice
    const invoice = await invoiceService.uploadInvoice(user.id, { file })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const user = await authService.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get user's invoices
    const invoices = await invoiceService.getUserInvoices(user.id)

    return NextResponse.json(invoices)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Endpoints**:
- `POST /api/invoices` — upload file, return created invoice (201)
- `GET /api/invoices` — list user's invoices (200)

### 7.3 Create [src/app/api/cron/process-invoices/route.ts](src/app/api/cron/process-invoices/route.ts)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { invoiceService } from '@/services/invoice.service'

export const maxDuration = 10 // Vercel Hobby limit

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends Authorization header)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await invoiceService.processPendingInvoices()
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
```

**Endpoint**:
- `GET /api/cron/process-invoices` — process up to 5 pending invoices, return results (requires Vercel cron authorization)

### 7.4 Create [vercel.json](vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/process-invoices",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Vercel cron configuration:
- **Path**: `/api/cron/process-invoices`
- **Schedule**: Every 5 minutes (cron syntax: `*/5 * * * *`)
- Vercel automatically sends `Authorization: Bearer {CRON_SECRET}` header

---

## Phase 8: UI Pages & Components

### 8.1 Add shadcn components

```bash
npx shadcn@latest add button card input label form table badge toast
```

Installs to [src/components/ui/](src/components/ui/).

### 8.2 Create [src/app/layout.tsx](src/app/layout.tsx)

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

### 8.3 Create [src/app/page.tsx](src/app/page.tsx)

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

Redirects authenticated users to dashboard, others to login.

### 8.4 Create [src/app/(auth)/login/page.tsx](src/app/(auth)/login/page.tsx)

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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

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
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4">
            Don't have an account?{' '}
            <Link href="/register" className="text-blue-600 hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

Login form using shadcn components.

### 8.5 Create [src/app/(auth)/register/page.tsx](src/app/(auth)/register/page.tsx)

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

export default function RegisterPage() {
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
    const fullName = formData.get('fullName') as string

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) throw new Error(signUpError.message)

      // Sign in immediately after signup
      if (data.user) {
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Sign up to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
              <p className="text-xs text-gray-500">At least 8 characters</p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

Registration form with full name field.

### 8.6 Create [src/app/(protected)/layout.tsx](src/app/(protected)/layout.tsx)

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
      <Button variant="outline" type="submit">
        Sign Out
      </Button>
    </form>
  )
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if user is authenticated
  try {
    const user = await authService.getUser()
    if (!user) {
      redirect('/login')
    }
  } catch {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation bar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex gap-4">
            <Link href="/dashboard" className="font-semibold text-lg">
              Invoice Processor
            </Link>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link href="/invoices" className="text-sm text-gray-600 hover:text-gray-900">
              Invoices
            </Link>
            <SignOutButton />
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
```

Protected layout enforces authentication and provides nav bar.

### 8.7 Create [src/app/(protected)/dashboard/page.tsx](src/app/(protected)/dashboard/page.tsx)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
    failed: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const res = await fetch('/api/invoices')
      if (!res.ok) throw new Error('Failed to fetch invoices')

      const invoices = await res.json()

      setStats({
        total: invoices.length,
        pending: invoices.filter((inv: any) => inv.status === 'PENDING').length,
        completed: invoices.filter((inv: any) => inv.status === 'COMPLETED').length,
        failed: invoices.filter((inv: any) => inv.status === 'FAILED').length,
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to Invoice Processor</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center py-12 bg-white rounded border border-gray-200">
        <p className="text-gray-600">
          Ready to get started?{' '}
          <a href="/invoices" className="text-blue-600 hover:underline font-medium">
            Upload your first invoice
          </a>
        </p>
      </div>
    </div>
  )
}
```

Dashboard with summary cards.

### 8.8 Create [src/app/(protected)/invoices/page.tsx](src/app/(protected)/invoices/page.tsx)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload } from 'lucide-react'

interface Invoice {
  id: string
  fileName: string
  status: string
  uploadedAt: string
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-refresh while processing
  useEffect(() => {
    fetchInvoices()
    const interval = setInterval(() => {
      fetchInvoices()
    }, 10000) // Refresh every 10s

    return () => clearInterval(interval)
  }, [])

  async function fetchInvoices() {
    try {
      const res = await fetch('/api/invoices')
      if (!res.ok) throw new Error('Failed to fetch')

      const data = await res.json()
      setInvoices(data)
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      await fetchInvoices()
      e.currentTarget.value = '' // Reset input
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const statusBadgeVariant: Record<string, any> = {
    PENDING: 'outline',
    PROCESSING: 'secondary',
    COMPLETED: 'default',
    FAILED: 'destructive',
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-gray-600 mt-2">Manage your uploaded invoices</p>
        </div>

        <label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleUpload}
            disabled={isUploading}
            className="hidden"
          />
          <Button asChild disabled={isUploading}>
            <span className="cursor-pointer">
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload Invoice'}
            </span>
          </Button>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">Loading...</div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-gray-600">No invoices yet. Upload your first invoice to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Invoices ({invoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium">File Name</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Uploaded</th>
                    <th className="text-left py-3 px-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{invoice.fileName}</td>
                      <td className="py-3 px-4">
                        <Badge variant={statusBadgeVariant[invoice.status]}>
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(invoice.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/invoices/${invoice.id}`}>
                          <Button variant="link" className="p-0">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

Invoice list page with upload form and polling.

### 8.9 Create [src/app/(protected)/invoices/[id]/page.tsx](src/app/(protected)/invoices/[id]/page.tsx)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, ArrowLeft } from 'lucide-react'

interface Invoice {
  id: string
  fileName: string
  fileUrl: string
  status: string
  extractedData?: Record<string, any>
  errorMessage?: string
  uploadedAt: string
  processedAt?: string
}

export default function InvoiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoice()
    const interval = setInterval(fetchInvoice, 5000) // Refresh every 5s

    return () => clearInterval(interval)
  }, [])

  async function fetchInvoice() {
    try {
      const res = await fetch(`/api/invoices/${params.id}`)
      if (!res.ok) throw new Error('Invoice not found')

      const data = await res.json()
      setInvoice(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <Link href="/invoices">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Invoice not found'}
        </div>
      </div>
    )
  }

  const statusBadgeVariant: Record<string, any> = {
    PENDING: 'outline',
    PROCESSING: 'secondary',
    COMPLETED: 'default',
    FAILED: 'destructive',
  }

  return (
    <div className="space-y-6">
      <Link href="/invoices">
        <Button variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </Link>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">{invoice.fileName}</h1>
          <div className="flex gap-4 mt-4">
            <Badge variant={statusBadgeVariant[invoice.status]}>
              {invoice.status}
            </Badge>
            <span className="text-sm text-gray-600">
              Uploaded: {new Date(invoice.uploadedAt).toLocaleString()}
            </span>
          </div>
        </div>

        <Button>
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>

      {invoice.status === 'FAILED' && invoice.errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Processing Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{invoice.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {['PROCESSING', 'PENDING'].includes(invoice.status) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-yellow-700">⏳ Processing your invoice... Please wait.</p>
          </CardContent>
        </Card>
      )}

      {invoice.status === 'COMPLETED' && invoice.extractedData && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invoice.extractedData.vendor && (
                <div>
                  <p className="text-sm text-gray-600">Vendor</p>
                  <p className="font-medium">{invoice.extractedData.vendor}</p>
                </div>
              )}

              {invoice.extractedData.amount && (
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="font-medium text-lg">${invoice.extractedData.amount.toFixed(2)}</p>
                </div>
              )}

              {invoice.extractedData.date && (
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-medium">{invoice.extractedData.date}</p>
                </div>
              )}

              {invoice.extractedData.lineItems && invoice.extractedData.lineItems.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">Line Items</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-t border-gray-200">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2">Description</th>
                          <th className="text-right py-2 px-2">Qty</th>
                          <th className="text-right py-2 px-2">Unit Price</th>
                          <th className="text-right py-2 px-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.extractedData.lineItems.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-200">
                            <td className="py-2 px-2">{item.description}</td>
                            <td className="text-right py-2 px-2">{item.quantity}</td>
                            <td className="text-right py-2 px-2">${item.unitPrice.toFixed(2)}</td>
                            <td className="text-right py-2 px-2">${item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

Invoice detail page with extracted data display.

---

## Phase 9: Configuration & Deployment

### 9.1 Configure [next.config.js](next.config.js)

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
}

module.exports = nextConfig
```

Allows Next.js Image component from Supabase Storage domain.

### 9.2 Add missing dependency

```bash
npm install uuid
npm install --save-dev @types/uuid
```

For generating file names in storage service.

### 9.3 Update [src/services/storage.service.ts](src/services/storage.service.ts) imports

```typescript
import { v4 as uuidv4 } from 'uuid'
```

### 9.4 Deploy to Vercel

1. **Commit to GitHub**:
   ```bash
   git add .
   git commit -m "Initial invoice processor POC setup"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import the GitHub repo `mkaraivanov/invoice-processor`
   - Select root directory (default: `.`)

3. **Add Environment Variables**:
   - In Vercel project settings, under "Environment Variables", add all vars from `.env.local`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `DATABASE_URL`
     - `DIRECT_URL`
     - `CRON_SECRET` (generate a random string: `openssl rand -hex 32`)

4. **Enable Cron**:
   - Vercel automatically reads [vercel.json](vercel.json) and enables the `/api/cron/process-invoices` endpoint
   - View cron runs in Vercel dashboard under "Cron Jobs"

5. **Deploy**:
   - Vercel automatically builds and deploys on `git push`
   - Verify deployment at `https://<project>.vercel.app`

---

## Phase 10: Verification Checklist

### Local Development
- [ ] `npm run dev` runs without errors
- [ ] `http://localhost:3000/login` renders login page
- [ ] `http://localhost:3000/register` renders registration page
- [ ] Register new user → redirects to dashboard
- [ ] Login existing user → redirects to dashboard
- [ ] Dashboard shows summary cards
- [ ] `/invoices` page loads with upload form
- [ ] Upload PDF/image → appears in list with `PENDING` status

### Database
- [ ] `npx prisma studio` shows `User` and `Invoice` tables
- [ ] New user registration creates entry in `users` table
- [ ] Upload creates entry in `invoices` table with `status = PENDING`

### Cron Processing (Local Test)
```bash
# Set CRON_SECRET locally
export CRON_SECRET="test-secret"

# Call the endpoint
curl -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron/process-invoices
```
- [ ] Response shows processed invoices
- [ ] Invoice status in DB changes from `PENDING` → `COMPLETED`
- [ ] `extractedData` is populated with mock data

### Auth & Security
- [ ] Unauthenticated user accessing `/dashboard` redirects to `/login`
- [ ] Unauthenticated `POST /api/invoices` returns 401
- [ ] User A cannot see User B's invoices
- [ ] User A cannot access User B's uploaded files in Storage

### Vercel Deployment
- [ ] Deploy to Vercel successfully
- [ ] Environment variables set correctly
- [ ] Cron job visible in Vercel dashboard
- [ ] Cron runs every 5 minutes (check logs)
- [ ] Login/register works on production
- [ ] Upload and cron processing work end-to-end on production

---

## Future Enhancements (Post-POC)

1. **Real AI/OCR Integration** — Replace mocked `processInvoice()` with OpenAI GPT-4o Vision or Google Document AI
2. **Webhook Notifications** — Send email when invoice processing completes/fails
3. **Audit Logging** — Track who uploaded/processed which invoice
4. **Role-Based Access** — Admin dashboard, team collaborators, etc.
5. **Retry Logic** — Exponential backoff for failed processing attempts
6. **Rate Limiting** — Prevent abuse of upload/cron endpoints
7. **Advanced Search** — Filter invoices by vendor, amount, date range
8. **Batch Processing** — Process multiple invoices in parallel (with timeout awareness)
9. **Supabase Edge Functions** — Move processing out of Vercel for greater reliability
10. **Database Replication** — Multi-region setup for high availability

---

## Architecture Summary

| Layer | Technology | Responsibility |
|-------|-----------|-----------------|
| **UI Layer** | Next.js 15 (App Router) + shadcn/ui | Pages, forms, real-time polling |
| **Delivery Layer** | Next.js API Routes | HTTP endpoints, request/response handling |
| **Business Logic** | Services (`invoice.service`, `auth.service`, etc.) | Core domain logic, validation, orchestration |
| **Data Access** | Prisma + Repositories | CRUD operations, database queries |
| **Infrastructure** | Supabase (Auth + Storage + Postgres) | Authentication, file storage, data persistence |
| **Background Jobs** | Vercel Cron | Scheduled invoice processing |
| **Deployment** | Vercel + Supabase | Production hosting and observability |

---

## Development Workflow

1. **Create feature branch**: `git checkout -b feature/feature-name`
2. **Implement changes** in [src/](src/) (UI, services, repos, APIs)
3. **Test locally**: `npm run dev`, manual testing, `npx prisma studio`
4. **Commit**: `git add . && git commit -m "Descriptive message"`
5. **Push**: `git push origin feature/feature-name`
6. **Create PR** on GitHub for code review
7. **Merge to `main`** → Vercel auto-deploys

---

## Key Files Reference

| File | Purpose |
|------|---------|
| [prisma/schema.prisma](prisma/schema.prisma) | Database schema definition |
| [middleware.ts](middleware.ts) | Auth session refresh & route guarding |
| [vercel.json](vercel.json) | Cron job scheduling |
| [src/lib/supabase/](src/lib/supabase/) | Supabase client initialization |
| [src/services/](src/services/) | Business logic (auth, invoice, storage) |
| [src/repositories/](src/repositories/) | Data access layer |
| [src/app/](src/app/) | Next.js pages & API routes |
| [src/components/](src/components/) | React components (shadcn + custom) |
| [src/types/](src/types/) | TypeScript types & Zod schemas |

---

**Status**: Ready for implementation  
**Last Updated**: March 3, 2026  
**POC Target**: 2-3 weeks from scaffolding

# Phase 7: API Routes

## Goal
Implement the Next.js middleware, invoice API routes, and cron endpoint.

**Rules** (from `.claude/rules/api-routes.md`):
- `cookies()` must be awaited
- `params` typed as `Promise<{ id: string }>` and awaited
- Call service layer only — never repositories or Prisma directly
- Validate all inputs with Zod
- Error response format: `{ error: string }` with appropriate HTTP status

---

## 7.1 `middleware.ts` (project root)

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
```

Refreshes Supabase session on every request and guards routes.

> **Note**: API routes are excluded from the matcher to avoid unnecessary `getUser()` calls (50-200ms latency each). API routes perform their own auth checks via the service layer. If you need middleware-level auth for API routes, use `getSession()` (cookie-only, no network call) instead of `getUser()`.

---

## 7.1b Error mapping helper `src/lib/api-errors.ts`

API routes must never leak internal error details (Prisma table names, Supabase config, stack traces). Use a safe error mapper:

```typescript
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'Invoice not found': 'Invoice not found',
  'Unauthorized': 'Unauthorized',
  'No file provided': 'No file provided',
  'File must be PDF, PNG, or JPG': 'File must be PDF, PNG, or JPG',
  'File must be smaller than 10MB': 'File must be smaller than 10MB',
}

export function toSafeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  return SAFE_ERROR_MESSAGES[message] ?? 'An unexpected error occurred'
}
```

Use `toSafeErrorMessage(error)` in all catch blocks instead of returning `error.message` verbatim. Log the full error server-side with `console.error`.

---

## 7.2 `src/app/api/invoices/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { invoiceService } from '@/services/invoice.service'
import { toSafeErrorMessage } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    const user = await authService.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const invoice = await invoiceService.uploadInvoice(user.id, { file })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Invoice upload error:', error)
    const message = toSafeErrorMessage(error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authService.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const invoices = await invoiceService.getUserInvoices(user.id)

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Invoice list error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
```

**Endpoints**:
- `POST /api/invoices` — upload file, return created invoice (201)
- `GET /api/invoices` — list user's invoices (200)

---

## 7.3 `src/app/api/invoices/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { invoiceService } from '@/services/invoice.service'
import { toSafeErrorMessage } from '@/lib/api-errors'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await authService.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const invoice = await invoiceService.getInvoice(id, user.id)

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice detail error:', error)
    const message = toSafeErrorMessage(error)
    const status = message === 'Unauthorized' ? 403 : message === 'Invoice not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
```

**Endpoint**:
- `GET /api/invoices/[id]` — get single invoice with ownership check (200)

---

## 7.4 `src/app/api/cron/process-invoices/route.ts`

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
    console.error('Cron processing error:', error)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
```

**Endpoint**:
- `GET /api/cron/process-invoices` — process up to 3 pending invoices with 8s elapsed-time guard (requires `Authorization: Bearer {CRON_SECRET}`)

> **Security note**: Ensure `CRON_SECRET` is at least 32 bytes (`openssl rand -hex 32`). On Vercel Pro, also validate the `x-vercel-cron-auth` header for defense in depth.

---

## 7.4b Body size limit in `next.config.js`

Add a body size limit to prevent large uploads from buffering entirely into serverless function memory before validation:

```javascript
experimental: {
  serverActions: {
    bodySizeLimit: '12mb', // Slightly above the 10MB Zod validation limit
  },
},
```

> **Note**: For API routes using `formData()`, Next.js doesn't support `api.bodyParser.sizeLimit` in App Router. The Vercel platform enforces a 4.5MB limit on Hobby and 50MB on Pro by default. For Hobby plan, this is already sufficient protection. For Pro, consider validating `Content-Length` header before reading the body.

---

## 7.5 `vercel.json`

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

Vercel cron runs every 5 minutes and automatically sends the `Authorization: Bearer {CRON_SECRET}` header.

---

## Checklist
- [ ] `middleware.ts` exists at project root (not `src/`)
- [ ] Middleware matcher excludes `api/` routes
- [ ] `src/lib/api-errors.ts` created with safe error mapping
- [ ] API routes never return raw `error.message` — use `toSafeErrorMessage`
- [ ] `GET /api/invoices` returns 401 for unauthenticated requests
- [ ] `POST /api/invoices` returns 401 for unauthenticated requests
- [ ] `GET /api/invoices/[id]` uses `params` as `Promise<{ id: string }>` and awaits it
- [ ] `GET /api/invoices/[id]` returns 403 for ownership mismatch
- [ ] Cron route checks `Authorization: Bearer {CRON_SECRET}` (32+ byte secret)
- [ ] `vercel.json` created with cron config

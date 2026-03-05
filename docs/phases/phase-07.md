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
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

Refreshes Supabase session on every request and guards routes.

---

## 7.2 `src/app/api/invoices/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { authService } from '@/services/auth.service'
import { invoiceService } from '@/services/invoice.service'

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
    const message = error instanceof Error ? error.message : 'Upload failed'
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
    const message = error instanceof Error ? error.message : 'Fetch failed'
    return NextResponse.json({ error: message }, { status: 500 })
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
    const message = error instanceof Error ? error.message : 'Not found'
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
    const message = error instanceof Error ? error.message : 'Processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Endpoint**:
- `GET /api/cron/process-invoices` — process up to 5 pending invoices (requires `Authorization: Bearer {CRON_SECRET}`)

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
- [ ] `GET /api/invoices` returns 401 for unauthenticated requests
- [ ] `POST /api/invoices` returns 401 for unauthenticated requests
- [ ] `GET /api/invoices/[id]` uses `params` as `Promise<{ id: string }>` and awaits it
- [ ] `GET /api/invoices/[id]` returns 403 for ownership mismatch
- [ ] Cron route checks `Authorization: Bearer {CRON_SECRET}`
- [ ] `vercel.json` created with cron config

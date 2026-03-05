---
name: write-tests
description: Write Vitest tests for a specified file following the project's 3-project config
disable-model-invocation: true
argument-hint: "[file-path]"
---
Write Vitest tests for `$ARGUMENTS`. Read the target file first.

## Step 1: Determine the test tier

| Source file location | Tier | Test file location | Env |
|---|---|---|---|
| `src/repositories/**` | unit | `tests/unit/repositories/` | node |
| `src/services/**` | unit | `tests/unit/services/` | node |
| `src/utils/**` | unit | `tests/unit/utils/` | node |
| `src/app/api/**` | integration | `tests/integration/api/` | node |
| `src/components/**` | components | `tests/components/` | jsdom |
| `src/app/**/page.tsx` (Client Components) | components | `tests/components/` | jsdom |

Test filename mirrors source: `invoice.service.ts` → `invoice.service.spec.ts`

## Step 2: Tier-specific patterns

### Repositories — real database, no mocks

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { invoiceRepository } from '@/repositories/invoice.repository'
import { prisma } from '@/lib/prisma'
import { InvoiceStatus } from '@/app/generated/prisma/client'  // ← custom path, not @prisma/client

describe('invoiceRepository', () => {
  const testUserId = 'test-user-' + Math.random().toString(36).slice(2)

  beforeEach(async () => {
    await prisma.invoice.deleteMany({ where: { userId: testUserId } })
  })

  it('creates and retrieves an invoice', async () => { ... })
  it('returns null for a missing id', async () => { ... })
})
```

Key rules:
- Use real test DB (`DATABASE_URL` from `.env.test`)
- Random test IDs to avoid cross-test contamination
- Never mock `prisma` in repository tests

### Services — mocked dependencies

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoiceService } from '@/services/invoice.service'
import { invoiceRepository } from '@/repositories/invoice.repository'

vi.mock('@/repositories/invoice.repository')

describe('invoiceService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws Unauthorized when userId does not match', async () => {
    vi.mocked(invoiceRepository.findById).mockResolvedValue({
      id: '1', userId: 'owner', ...
    })
    await expect(
      invoiceService.getById('1', 'other-user')
    ).rejects.toThrow('Unauthorized')
  })
})
```

Key rules:
- Mock all repositories
- **Always** test the ownership check: wrong userId must throw `'Unauthorized'`
- Test Zod validation failures with invalid inputs

### API routes — mock service layer

```typescript
import { GET } from '@/app/api/invoices/route'
import { NextRequest } from 'next/server'
import * as authSvc from '@/services/auth.service'
import * as invoiceSvc from '@/services/invoice.service'

vi.mock('@/services/auth.service')
vi.mock('@/services/invoice.service')

it('returns 401 when unauthenticated', async () => {
  vi.mocked(authSvc.authService.getUser).mockResolvedValue(null)
  const req = new NextRequest('http://localhost/api/invoices')
  const res = await GET(req)
  expect(res.status).toBe(401)
})
```

### Components — jsdom

```typescript
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import InvoiceList from '@/components/InvoiceList'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({}),
}))
```

## Step 3: Coverage targets

For every method, cover:
- Happy path
- Validation error (if Zod is used)
- Not-found case
- Unauthorized case (if ownership is checked)

Do not write tests that only assert a mock was called — assert observable behavior (return values, thrown errors, rendered text).

## Step 4: Run and verify

```bash
npx vitest run <test-file-path>
```
Fix any failures before marking done.

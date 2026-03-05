# Phase 5: Repository Layer

## Goal
Implement `src/lib/prisma.ts` (singleton), `user.repository.ts`, and `invoice.repository.ts`.

**Rules** (from `.claude/rules/repositories.md`):
- Import from `@/app/generated/prisma/client` — never `@prisma/client`
- No business logic, no auth checks — data access only
- Constructor: `constructor(private prisma: PrismaClient)`

---

## 5.1 `src/lib/prisma.ts`

```typescript
import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

Singleton pattern — prevents multiple PrismaClient instances in development.
Uses the **driver adapter pattern** required by Prisma v6+.

---

## 5.2 `src/repositories/user.repository.ts`

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
- `upsert(id, email, fullName?)` — create or update user from Supabase Auth event
- `findById(id)` — get user by ID
- `findByEmail(email)` — get user by email

---

## 5.3 `src/repositories/invoice.repository.ts`

```typescript
import { prisma } from '@/lib/prisma'
import { InvoiceStatus } from '@/app/generated/prisma/client'

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
- `findByUserId(userId, limit)` — list user's invoices newest-first
- `updateStatus(id, status, extractedData?, errorMessage?)` — update after processing; sets `processedAt` on COMPLETED/FAILED
- `findPending(limit)` — get oldest pending invoices for cron
- `delete(id)` — remove invoice record

---

## Checklist
- [ ] `src/lib/prisma.ts` uses `PrismaPg` adapter
- [ ] `src/lib/prisma.ts` uses singleton pattern
- [ ] Repositories import from `@/app/generated/prisma/client` (not `@prisma/client`)
- [ ] `userRepository` implemented with upsert, findById, findByEmail
- [ ] `invoiceRepository` implemented with all 6 methods
- [ ] No auth checks or business logic in repositories

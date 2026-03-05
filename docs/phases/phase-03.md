# Phase 3: Database Schema (Prisma)

## Goal
Define the Prisma schema, run the initial migration, and generate the client.

---

## 3.1 Update `prisma/schema.prisma`

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
  id            String        @id @default(uuid())
  userId        String
  fileName      String
  fileUrl       String
  status             InvoiceStatus @default(PENDING)
  extractedData      Json?
  errorMessage       String?
  uploadedAt         DateTime      @default(now())
  processingStartedAt DateTime?
  processedAt        DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

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
- `Invoice.processingStartedAt` tracks when processing began — used to reclaim stuck jobs
- `Invoice.extractedData` is `Json` for flexible parsed invoice fields
- Indexes on `userId` and `status` for fast lookups
- Cascade delete: deleting a user deletes their invoices

---

## 3.2 Run initial migration

```bash
npx prisma migrate dev --name init
```

Creates `prisma/migrations/` folder with migration SQL.
Requires `DATABASE_URL` and `DIRECT_URL` in `.env.local` (or `.env`).

---

## 3.3 Generate Prisma client

```bash
npx prisma generate
```

Outputs client to `src/app/generated/prisma/`.

**Import path** (use everywhere): `@/app/generated/prisma/client`
**Never use**: `@prisma/client`

---

## 3.4 Verify schema (optional)

```bash
npx prisma studio
```

Opens Prisma Studio UI to inspect/edit records locally.

---

## Checklist
- [ ] `prisma/schema.prisma` has `generator client` with custom `output` path
- [ ] `prisma/schema.prisma` has `directUrl` in datasource
- [ ] `npx prisma migrate dev --name init` succeeds
- [ ] `npx prisma generate` succeeds
- [ ] `src/app/generated/prisma/` directory created
- [ ] `User` and `Invoice` tables visible in Prisma Studio

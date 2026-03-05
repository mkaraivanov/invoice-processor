---
applyTo: "src/repositories/**"
---
# Repository Conventions

- Import: `import { PrismaClient, Prisma } from '@/app/generated/prisma/client'` (**never** `@prisma/client`)
- Constructor: `constructor(private prisma: PrismaClient)`
- Return types: use generated Prisma types (e.g. `Prisma.InvoiceGetPayload<...>`)
- No business logic — data access only
- No auth checks — that belongs in the service layer

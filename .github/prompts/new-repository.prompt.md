---
mode: agent
description: Scaffold a Prisma-backed repository for a given model
---
Create a repository for the `${input:modelName}` model following project conventions.

Rules:
- File: `src/repositories/${input:modelName:lower}.repository.ts` (kebab-case)
- Import: `import { PrismaClient, Prisma } from '@/app/generated/prisma/client'`
- Constructor: `constructor(private prisma: PrismaClient)`
- Return types: generated Prisma types (`Prisma.${input:modelName}GetPayload<...>`)
- No business logic — data access only
- Implement: findById, findByUserId, create, update, delete

After generating, run `npm run type-check` to verify.

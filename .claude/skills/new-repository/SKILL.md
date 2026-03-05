---
name: new-repository
description: Scaffold a Prisma-backed repository for a given model
disable-model-invocation: true
argument-hint: "[ModelName]"
---
Scaffold a new repository for the `$ARGUMENTS` model following project conventions.

Rules (also in @.claude/rules/repositories.md):
- File: `src/repositories/$ARGUMENTS.repository.ts` (kebab-case filename)
- Import: `import { PrismaClient } from '@/app/generated/prisma/client'`
- Constructor: `constructor(private prisma: PrismaClient)`
- Return types: use generated Prisma types (e.g. `Prisma.$ARGUMENTSGetPayload<...>`)
- No business logic — data access only
- Implement: findById, findByUserId, create, update, delete (soft-delete if schema supports it)

After scaffolding, run `npm run type-check` to verify.

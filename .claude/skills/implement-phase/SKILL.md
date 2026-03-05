---
name: implement-phase
description: Implement a numbered phase from docs/phases/phase-$ARGUMENTS.md step by step
disable-model-invocation: true
argument-hint: "[phase-number]"
---
Read @docs/phases/readme.md. You are about to implement Phase $ARGUMENTS.

## Before you start

1. Locate the Phase $ARGUMENTS section. Read the ENTIRE phase — all subsections — before writing any code.
2. Scan the existing file tree with Glob to see what already exists. Do not recreate files; only fill in what is missing.
3. Install packages with `npm install` only (never yarn, pnpm, or bun).
4. If the phase involves Prisma schema changes, run the migration BEFORE touching source files.

## Critical constraints — check on every file you write

### Prisma
- Import path: `@/app/generated/prisma/client` — NEVER `@prisma/client`
- Enums (`InvoiceStatus`, etc.) also come from `@/app/generated/prisma/client`
- Never instantiate `PrismaClient` outside `src/lib/prisma.ts`

### Next.js 15
- `cookies()` from `next/headers` is async — always `await cookies()`
- Server Component params: `const { id } = await params` where `params: Promise<{ id: string }>`

### Supabase SSR
- Use `@supabase/ssr` only — never `@supabase/auth-helpers-nextjs`
- Middleware `setAll` must set cookies on BOTH request AND response

### Services and access control
- Services import repositories, never `prisma` directly
- Every data-access method must verify `record.userId === requestingUserId` before returning

### File naming
- Source files: `kebab-case.ts` / `kebab-case.tsx`
- Components: `PascalCase.tsx`
- Tests: `*.spec.ts` in `tests/` (not co-located)

## Implementation order
Follow the plan's numbered subsections in sequence — they are ordered by dependency.

## After completing the phase

```bash
npx tsc --noEmit
npm run lint
```

Manual checklist:
- [ ] All Prisma imports use `@/app/generated/prisma/client`
- [ ] All `cookies()` calls are awaited
- [ ] Every service method that accesses invoice data checks ownership
- [ ] No `.env` or `.env.local` files were touched

Then invoke the `code-review` skill — a completed phase is a full feature boundary.

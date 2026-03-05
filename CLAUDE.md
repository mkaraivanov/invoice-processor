> Read this FIRST before any implementation task.

# Invoice Processor

## Stack
Next.js 15 App Router · Supabase (Auth/Storage/Postgres) · Prisma v6+ · shadcn/ui · Vercel · **npm**

## Architecture
Repository → Services → API routes / UI. Prisma bypasses RLS — enforce access control in services, never in repositories.

## Critical: Prisma
- Import: `@/app/generated/prisma/client` (**never** `@prisma/client`)
- Driver adapter: `@prisma/adapter-pg` + `PrismaPg`
- Singleton: `src/lib/prisma.ts`

## Critical: Next.js 15
- `cookies()` must be **awaited**
- Server Component `params` typed as `Promise<{ id: string }>` and awaited

## Critical: Supabase SSR
- Use `@supabase/ssr` only (not `auth-helpers-nextjs`)
- `setAll` must set cookies on **both** request AND response

## Commands
```bash
npm run dev           # Next.js dev server
npm run build         # production build
npm run lint          # ESLint
npm run type-check    # tsc --noEmit
npm test              # Vitest unit/integration
npx prisma migrate dev    # create + apply migration
npx prisma generate       # regenerate client → src/app/generated/prisma
```

## File naming
- Files: `kebab-case.ts` (`invoice.service.ts`, `invoice.repository.ts`)
- Components: `PascalCase.tsx` (`InvoiceList.tsx`)
- Tests: `*.spec.ts(x)` in `tests/`
- Suffixes: `*.types.ts` | `*.schema.ts` | `*.repository.ts` | `*.service.ts`

## shadcn/ui
`components.json` must include `"hooks": "@/hooks"`.

## MCP integrations
- **Context7** — look up Next.js 15, Prisma, Supabase, shadcn/ui docs
- **Supabase MCP** — DB queries, schema inspection, project status
- **Playwright MCP** — run and inspect E2E tests in a real browser

## Git conventions
Commit format: `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf, ci)

## Context management
- `/clear` between unrelated tasks
- `/compact` after completing a full implementation phase
- Use subagents for investigation to preserve main context

## Convention docs (read on-demand)
- `@docs/IMPLEMENTATION_PLAN.md` — phases, architecture, step-by-step tasks
- `@docs/TESTING_STRATEGY.md` — test tiers, fixture patterns, Playwright auth setup

## Pre-Implementation Checklist
1. Touching repositories → check `.claude/rules/repositories.md`
2. Touching API routes → check `.claude/rules/api-routes.md`
3. Writing tests → read `docs/TESTING_STRATEGY.md` for correct tier and fixture pattern

> **During initial POC build only**: before starting any phase, read the relevant section of `docs/IMPLEMENTATION_PLAN.md`. Handled automatically by `/implement-phase`.

## Post-Implementation Checklist
```
□ npm run lint && npm run type-check pass
□ Prisma imports use @/app/generated/prisma/client (never @prisma/client)
□ All cookies() calls are awaited
□ Zod validation on all API route inputs
□ Auth check in service layer before any data access
□ Invoice ownership verified before read/write operations
□ Unit/integration tests written for new service/repository methods
□ Run /verify before committing
```

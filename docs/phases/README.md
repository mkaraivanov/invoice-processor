# Implementation Phases

Each file covers one phase of the Invoice Processor POC build.
Implement phases in order — each builds on the previous.

## Stack (all phases)
Next.js 15 App Router · Supabase (Auth/Storage/Postgres) · Prisma v6+ · shadcn/ui · Vercel · **npm**

## Architecture
```
Repository → Services → API routes / UI
```
- Prisma bypasses Supabase RLS — enforce access control in **services**, never repositories
- `@supabase/ssr` (not `auth-helpers-nextjs`)
- Prisma import: `@/app/generated/prisma/client` (never `@prisma/client`)
- Driver adapter: `@prisma/adapter-pg` + `PrismaPg`

## Phase Index

| File | Phase | Description |
|------|-------|-------------|
| [phase-01.md](phase-01.md) | 1 | Project Scaffolding |
| [phase-02.md](phase-02.md) | 2 | Project Structure |
| [phase-03.md](phase-03.md) | 3 | Database Schema (Prisma) |
| [phase-04.md](phase-04.md) | 4 | Supabase Setup |
| [phase-05.md](phase-05.md) | 5 | Repository Layer |
| [phase-06.md](phase-06.md) | 6 | Services Layer |
| [phase-07.md](phase-07.md) | 7 | API Routes |
| [phase-08.md](phase-08.md) | 8 | UI Pages & Components |
| [phase-09.md](phase-09.md) | 9 | Configuration & Deployment |
| [phase-10.md](phase-10.md) | 10 | Verification Checklist |

## Key File Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema |
| `middleware.ts` | Auth session refresh & route guarding |
| `vercel.json` | Cron job scheduling |
| `src/lib/supabase/` | Supabase client initialization |
| `src/services/` | Business logic (auth, invoice, storage) |
| `src/repositories/` | Data access layer |
| `src/app/` | Next.js pages & API routes |
| `src/components/` | React components (shadcn + custom) |
| `src/types/` | TypeScript types & Zod schemas |

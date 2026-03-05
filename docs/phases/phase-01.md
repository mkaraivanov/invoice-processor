# Phase 1: Project Scaffolding

## Goal
Bootstrap a Next.js 15 App Router project with TypeScript, Tailwind, shadcn/ui, and all core dependencies.

---

## 1.1 Initialize Next.js project

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Answers:
- TypeScript: Yes
- ESLint: Yes
- App Router: Yes
- Tailwind CSS: Yes
- Turbopack: No
- Import alias: `@/*`

Creates `src/app/` with App Router structure.

> **Next.js 15**: `cookies()` must be awaited. Server Component `params` typed as `Promise<{ id: string }>` and awaited.

---

## 1.2 Initialize shadcn/ui

```bash
npx shadcn@latest init
```

- Style: "New York"
- Base color: slate
- CSS variables: Yes

Configures `components.json` and `src/lib/utils.ts`.

Verify `components.json` includes the `hooks` alias:

```json
{
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

---

## 1.3 Install core dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install prisma --save-dev && npm install @prisma/client @prisma/adapter-pg
npm install zod
npm install lucide-react
npm install uuid
npm install --save-dev @types/uuid
```

---

## 1.4 Initialize Prisma

```bash
npx prisma init
```

Creates `prisma/schema.prisma` and adds `DATABASE_URL` to `.env`.

---

## 1.5 Create `.env.local`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Server-only (never expose to browser)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Prisma (use pooled connection from PgBouncer)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:6543/postgres?schema=public&pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?schema=public

# Cron security
CRON_SECRET=your-random-secret-key-here
```

**Notes**:
- `DATABASE_URL` uses port 6543 (PgBouncer) for connection pooling — safe for serverless. Must include `?pgbouncer=true&connection_limit=1` to avoid `prepared statement already exists` errors.
- `DIRECT_URL` uses port 5432 (direct) for Prisma migrations only — do not use in API routes
- `NEXT_PUBLIC_*` vars are safe to expose (URL and anon key are public by design)
- `SUPABASE_SERVICE_ROLE_KEY` never commits to repo

---

## Checklist
- [ ] `npm run dev` runs without errors
- [ ] `components.json` has `"hooks": "@/hooks"` alias
- [ ] `.env.local` created (not committed)
- [ ] `prisma/schema.prisma` exists

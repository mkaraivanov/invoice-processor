# GitHub Copilot Instructions — Invoice Processor

## Stack
Next.js 15 App Router · Supabase (Auth/Storage/Postgres) · Prisma v6+ · shadcn/ui · Vercel · **npm**

## Architecture
Repository → Services → API routes / UI. Prisma bypasses RLS — enforce access control in services.

## Critical: Prisma import path
**Always** import from `@/app/generated/prisma/client`, **never** from `@prisma/client`.
```ts
import { PrismaClient, Prisma } from '@/app/generated/prisma/client'
```

## Critical: Next.js 15 async patterns
```ts
// cookies() must be awaited
const cookieStore = await cookies()

// params typed as Promise and awaited
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

## Critical: Supabase SSR cookie pattern
Use `@supabase/ssr` only. `setAll` must set cookies on **both** request AND response:
```ts
cookies: {
  getAll() { return request.cookies.getAll() },
  setAll(cookiesToSet) {
    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
    supabaseResponse = NextResponse.next({ request })
    cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
  }
}
```

## Repository pattern
- Repositories wrap Prisma — data access only, no business logic
- Services import repositories (never Prisma directly), enforce auth + ownership
- API routes call services only

## Testing
- **npm** only (never yarn/pnpm)
- Three Vitest projects: `unit` (node), `integration` (node + real DB), `components` (jsdom)
- E2E: Playwright with auth established in `tests/e2e/auth.setup.ts`
- Test files: `tests/<tier>/*.spec.ts(x)`

## MCP
Always use Context7 MCP when you need library/API documentation, code generation, or setup steps — without me having to explicitly ask.

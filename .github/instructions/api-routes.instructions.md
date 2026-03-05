---
applyTo: "src/app/api/**"
---
# API Route Conventions

- `cookies()` must be **awaited**: `const cookieStore = await cookies()`
- `params` typed as `Promise<{ id: string }>` and awaited: `const { id } = await params`
- Call the service layer only — never repositories or Prisma directly
- Validate all inputs with Zod before passing to services
- Error response format: `return NextResponse.json({ error: 'message' }, { status: 4xx })`
- Use `@supabase/ssr` for auth — never `auth-helpers-nextjs`

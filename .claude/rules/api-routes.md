---
applyTo: "src/app/api/**"
---
# API Route Rules

- `cookies()` must be **awaited**: `const cookieStore = await cookies()`
- `params` typed as `Promise<{ id: string }>` and awaited: `const { id } = await params`
- Call the service layer only — never repositories or Prisma directly
- Validate all inputs with Zod before passing to services
- Error response format: `{ error: string }` with appropriate HTTP status
- Use `@supabase/ssr` for auth — never `auth-helpers-nextjs`

---
name: code-review
description: Review changed code for correctness, security, and project conventions. Invoke after completing a full feature or implementation phase — not after individual file edits.
---
Review all code changed since the last commit (or in the current branch) against project conventions.

Check for:
1. **Prisma imports** — must use `@/app/generated/prisma/client`, never `@prisma/client`
2. **Next.js 15 async patterns** — `cookies()` awaited, `params` typed as `Promise<{...}>`
3. **Auth enforcement** — every service method that accesses data must check auth first
4. **Ownership verification** — invoice/resource ownership checked before read/write
5. **Zod validation** — all API route inputs validated with Zod
6. **Repository purity** — no business logic in repositories
7. **Service purity** — no direct Prisma usage in services (use repositories)
8. **Test coverage** — new service/repository methods have corresponding tests

Output: bulleted list of findings with file:line references, grouped by severity.

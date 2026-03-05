---
name: code-review
description: Review changed code for correctness, security, and project conventions. Invoke this skill automatically whenever a complete unit of work is done — a full implementation phase, a complete feature (repository + service + route + component all connected), or just before creating a PR. Do NOT invoke after editing a single file or mid-way through a feature. If the user says "done", "finished", "phase complete", "ready to commit", or similar, trigger this review immediately.
---
Review all recently changed code for correctness, security, and project conventions.

## When to invoke

Invoke after a COMPLETE UNIT OF WORK — all files for a feature or phase are written and connected. Do not invoke mid-task. Signals: the user said "done", "phase complete", "ready to commit", "all connected", or similar.

## Step 1: Identify changed files

```bash
git diff --name-only HEAD
git diff --name-only --staged
```

Read each changed file before forming an opinion.

## Step 2: Delegate to security-reviewer (if applicable)

If any changed file touches: authentication flows, API routes, invoice ownership logic, file upload, or middleware — invoke the `security-reviewer` agent:

```
Use the Agent tool: subagent_type=.claude/agents/security-reviewer
Provide: list of changed files + relevant code sections
```

Do not skip this for API route, service, or middleware changes.

## Step 3: Convention checklist

### Prisma
- [ ] All imports use `@/app/generated/prisma/client` (never `@prisma/client`)
- [ ] Enums imported from `@/app/generated/prisma/client`
- [ ] `PrismaClient` only instantiated in `src/lib/prisma.ts`

### Next.js 15
- [ ] `cookies()` always awaited
- [ ] Server Component params typed as `Promise<{ id: string }>` and awaited
- [ ] No hooks in Server Components

### Supabase
- [ ] `@supabase/ssr` used (not auth-helpers)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not reachable from browser
- [ ] Middleware `setAll` sets cookies on both request and response

### Services
- [ ] Services import repositories (never prisma directly)
- [ ] Every record-access method checks `record.userId === userId`
- [ ] Zod `.parse()` at method entry for external input
- [ ] `userId` passed as parameter (not fetched internally)

### Repositories
- [ ] No business logic
- [ ] Return `null` on not-found (no throw)

### API routes
- [ ] Auth check first (return 401 if no user)
- [ ] Call service layer only (not repositories)
- [ ] Error responses: `NextResponse.json({ error }, { status })`

### File naming
- [ ] Source: `kebab-case.ts`
- [ ] Tests: `*.spec.ts` in `tests/`

## Step 4: Report

```
## Code Review Report

### Security (from security-reviewer)
[Output, or "Not invoked — no auth/upload changes"]

### Convention violations
[file:line — issue — fix]

### Correctness issues
[Logic bugs, unhandled paths]

### Summary
Pass / Pass with minor issues / Fail
```

Fix any Fail-level findings immediately before declaring done.

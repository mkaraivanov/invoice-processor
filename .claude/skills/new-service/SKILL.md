---
name: new-service
description: Scaffold a service class for a given domain
disable-model-invocation: true
argument-hint: "[domain-name]"
---
Scaffold a new service for the `$ARGUMENTS` domain following project conventions.

Rules (also in @.claude/rules/services.md):
- File: `src/services/$ARGUMENTS.service.ts` (kebab-case filename)
- Import repositories (never Prisma directly)
- Enforce auth check at the start of every method that accesses data
- Verify resource ownership before read/write
- Use Zod schemas (in `src/schemas/$ARGUMENTS.schema.ts`) for input validation
- Keep business logic here — not in repositories or API routes

After scaffolding, run `npm run type-check` to verify.

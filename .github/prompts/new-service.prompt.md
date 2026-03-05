---
mode: agent
description: Scaffold a service class for a given domain
---
Create a service for the `${input:domainName}` domain following project conventions.

Rules:
- File: `src/services/${input:domainName}.service.ts` (kebab-case)
- Import repositories — never import Prisma directly
- Enforce auth check at the start of every data-access method
- Verify resource ownership before read/write
- Use Zod schema from `src/schemas/${input:domainName}.schema.ts` for input validation
- Business logic here — not in repositories or API routes

After generating, run `npm run type-check` to verify.

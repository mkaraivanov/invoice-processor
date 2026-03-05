---
mode: agent
description: Implement a numbered phase from docs/IMPLEMENTATION_PLAN.md
---
Read `docs/IMPLEMENTATION_PLAN.md` and implement Phase ${input:phaseNumber} step by step.

For each step:
1. Read relevant source files before making changes
2. Follow all conventions in `CLAUDE.md` and path-scoped instructions in `.github/instructions/`
3. After completing all steps, run the Post-Implementation Checklist:
   - `npm run lint && npm run type-check` pass
   - Prisma imports use `@/app/generated/prisma/client`
   - All `cookies()` calls are awaited
   - Zod validation on all API route inputs
   - Auth check in service layer before any data access

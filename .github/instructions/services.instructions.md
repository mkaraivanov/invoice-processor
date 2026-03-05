---
applyTo: "src/services/**"
---
# Service Conventions

- Import and use repositories — never import Prisma or PrismaClient directly
- Enforce auth check at the start of every method that accesses data
- Verify resource ownership before any read/write operation
- Use Zod schemas for input validation (define schemas in `src/schemas/`)
- Keep all business logic here — not in repositories or API routes
- Method signature: `async methodName(userId: string, input: ValidatedInput): Promise<Result>`

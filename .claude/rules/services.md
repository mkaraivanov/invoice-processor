---
applyTo: "src/services/**"
---
# Service Rules

- Import and use repositories — never import Prisma directly
- Enforce auth check at the start of every method that accesses data
- Verify resource ownership before any read/write operation
- Use Zod schemas for input validation (schemas in `src/schemas/`)
- Keep all business logic here — not in repositories or API routes

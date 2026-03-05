---
name: db-migrate
description: Run prisma migrate dev, regenerate client to the correct output path, and verify import paths
disable-model-invocation: true
---
Run a Prisma migration and regenerate the client.

Steps:
1. Run `npx prisma migrate dev` (prompt for migration name if not provided)
2. Run `npx prisma generate` — client outputs to `src/app/generated/prisma`
3. Verify that all repository files import from `@/app/generated/prisma/client` (not `@prisma/client`)
4. Run `npm run type-check` to confirm the generated types are valid

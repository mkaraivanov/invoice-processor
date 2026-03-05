---
name: db-migrate
description: Run prisma migrate dev, regenerate client to the correct output path, and verify import paths
disable-model-invocation: true
---
Run a Prisma migration, regenerate the client, and verify import paths.

## Step 1: Validate the schema

```bash
npx prisma validate
```

Fix any errors before proceeding.

## Step 2: Run the migration

```bash
npx prisma migrate dev --name <describe-the-change>
```

Use a descriptive snake_case name (e.g., `add-invoice-line-items`).

`migrate dev` uses `DIRECT_URL` from `.env.local` (bypasses PgBouncer — already configured in `schema.prisma`'s `directUrl` field). If it fails with "cannot connect", check that `DIRECT_URL` is set and points to port 5432.

## Step 3: Regenerate the client

`migrate dev` runs `prisma generate` automatically, but confirm explicitly:

```bash
npx prisma generate
ls src/app/generated/prisma/
```

You should see `client/`, `index.d.ts`, etc. If the directory is empty, the `output` path in `schema.prisma` is wrong.

## Step 4: Scan for wrong import paths

```bash
grep -rn "from '@prisma/client'" src/ tests/
grep -rn 'from "@prisma/client"' src/ tests/
```

Any hits must be changed to `@/app/generated/prisma/client`.

## Step 5: Type-check

```bash
npx tsc --noEmit
```

Type errors referencing `@prisma/client` or missing Prisma types indicate wrong imports or a failed `prisma generate`.

## Step 6: Confirm the migration file

```bash
ls prisma/migrations/
```

Review the new migration SQL briefly — especially for destructive operations (DROP COLUMN, etc.).

## Important

`prisma migrate dev` is for local development only. Production uses `prisma migrate deploy` in CI — never run it locally.

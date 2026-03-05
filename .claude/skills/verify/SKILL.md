---
name: verify
description: Final pre-commit check: run type-check (npx tsc --noEmit), lint (npm run lint), and tests (npm test)
disable-model-invocation: true
---
Run the full pre-commit verification suite. Do not skip steps even if earlier ones pass.

## Step 1: TypeScript

```bash
npx tsc --noEmit
```

Fix all type errors before proceeding. Do not use `@ts-ignore` or `as any` without inline documentation.

Common causes in this project:
- Wrong Prisma import (`@prisma/client` → `@/app/generated/prisma/client`)
- `prisma generate` not run after schema change (run `/db-migrate`)
- Unawaited `cookies()` call
- Missing `await` on Server Component `params`

## Step 2: ESLint

```bash
npm run lint
```

Fix all errors. Warnings are acceptable.

## Step 3: Vitest

```bash
npm test
```

Runs all three Vitest projects (`unit`, `integration`, `components`) with `pool: 'forks'` and `maxWorkers: 1`. Do not change these settings.

To debug a single failing file:
```bash
npx vitest run tests/unit/services/invoice.service.spec.ts
```

If a test fails: determine whether the test is wrong (implementation changed) or the code is wrong (regression). Fix the root cause — do not delete failing tests.

## Step 4: Final import scan

```bash
grep -rn "from '@prisma/client'" src/ tests/
grep -rn 'from "@prisma/client"' src/ tests/
```

Fix any hits before committing.

## Step 5: Report

```
Verify complete:
✓ TypeScript: no errors
✓ ESLint: no errors
✓ Vitest: X passed (Y unit, Z integration, W component)
✓ Import paths: clean

Ready to commit.
```

List any fixes made during this run.

---

**Note on E2E**: Playwright tests are NOT included here — they require a running dev server. Run separately:
```bash
npx playwright test
```
E2E tests are a CI gate on PRs, not a local pre-commit requirement.

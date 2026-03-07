---
name: implement-test-phase
description: Implement a numbered testing strategy phase from docs/testing_strategy_phases/phase_$ARGUMENTS_*.md step by step
disable-model-invocation: true
argument-hint: "[phase-number]"
---
Read @docs/testing_strategy_phases/00_overview.md. You are about to implement Test Phase $ARGUMENTS.

## Before you start

1. Locate the file `docs/testing_strategy_phases/phase_$ARGUMENTS_*.md` and read it ENTIRELY — all subsections — before writing any code.
2. Scan the existing file tree with Glob to see what already exists. Do not recreate files; only fill in what is missing.
3. Install packages with `npm install` only (never yarn, pnpm, or bun).
4. Read `.claude/rules/testing.md` before writing any test files.

## Critical constraints — check on every file you write

### Test placement
- `tests/unit/` — pure logic, no DB, no network
- `tests/integration/` — real DB with transaction rollback in afterEach; never mock the DB
- `tests/components/` — React component tests with jsdom
- `tests/e2e/` — Playwright end-to-end tests

### Vitest
- Config uses three projects: `unit` (node), `integration` (node), `components` (jsdom)
- Integration tests must use transaction rollback wrapper — never commit test data
- Do NOT mock the DB in integration tests

### Playwright E2E
- Auth established in `tests/e2e/auth.setup.ts` — never re-login inside a test
- Browser projects declare `dependencies: ['setup']` and `storageState: 'playwright/.auth/user.json'`
- Avoid hard-coded waits — use `waitForSelector`, `waitForResponse`, or `expect(locator).toBeVisible()`

### Prisma imports (when used in fixtures/helpers)
- Import path: `@/app/generated/prisma/client` — NEVER `@prisma/client`
- Never instantiate `PrismaClient` outside `src/lib/prisma.ts`

### File naming
- Test files: `*.spec.ts` or `*.spec.tsx` in `tests/`
- Fixtures/helpers: `tests/fixtures/*.fixture.ts`, `tests/fixtures/mocks/*.mock.ts`

## Implementation order
Follow the phase's numbered subsections in sequence — they are ordered by dependency.

## After completing the phase

```bash
npx tsc --noEmit
npm run lint
npm test
```

Manual checklist:
- [ ] All test files are in the correct `tests/` subdirectory
- [ ] Integration tests roll back in `afterEach` — no committed test data
- [ ] No hard-coded waits in Playwright tests
- [ ] Playwright auth uses `auth.setup.ts` storage state, not mid-test login
- [ ] All Prisma imports in test helpers use `@/app/generated/prisma/client`

Then invoke the `code-review` skill — a completed phase is a full feature boundary.

---
applyTo: "tests/**"
---
# Testing Conventions

## Vitest — 3 project config
- `unit`: node environment, no DB, pure logic tests
- `integration`: node environment, real DB with transaction rollback in afterEach
- `components`: jsdom environment, React component tests

Pool config: `pool: 'forks'`, `maxWorkers: 1`

## Integration tests
- Use a transaction wrapper that rolls back in afterEach — never commit test data
- Do NOT mock the DB; test against a real (test) database

## Playwright E2E
- Auth setup: `tests/e2e/auth.setup.ts` — auth is established once, not per-test
- Browser projects: `dependencies: ['setup']`, `storageState: 'playwright/.auth/user.json'`
- Avoid hard-coded `waitForTimeout` — use `waitForSelector`, `waitForResponse`, or `expect(locator).toBeVisible()`

## File placement
- `tests/unit/` — mirrors `src/` structure, suffix `.spec.ts`
- `tests/integration/` — mirrors `src/` structure, suffix `.spec.ts`
- `tests/components/` — mirrors component structure, suffix `.spec.tsx`
- `tests/e2e/` — named by user flow, suffix `.spec.ts`

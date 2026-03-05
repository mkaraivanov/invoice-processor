---
applyTo: "tests/**"
---
# Testing Rules

## Vitest config — 3 projects
- `unit`: node environment, no DB, pure logic
- `integration`: node environment, real DB with transaction rollback in afterEach
- `components`: jsdom environment, React component tests

## Integration tests
- Use a transaction wrapper that rolls back in afterEach — never commit test data
- Do NOT mock the DB in integration tests

## Playwright E2E
- Auth established in `tests/e2e/auth.setup.ts` — never re-login inside a test
- Browser projects declare `dependencies: ['setup']` and `storageState: 'playwright/.auth/user.json'`
- Avoid hard-coded waits — use `waitForSelector`, `waitForResponse`, or `expect(locator).toBeVisible()`

## File placement
- `tests/unit/` — mirrors `src/` structure
- `tests/integration/` — mirrors `src/` structure
- `tests/components/` — mirrors `src/app/` or `src/components/` structure
- `tests/e2e/` — named by flow (e.g. `invoice-upload.spec.ts`)

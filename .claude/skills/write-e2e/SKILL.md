---
name: write-e2e
description: Write a Playwright E2E test for a specified flow using the project's auth setup pattern
disable-model-invocation: true
argument-hint: "[flow-description]"
---
Write a Playwright E2E test for: `$ARGUMENTS`

Read `docs/TESTING_STRATEGY.md` Phase 4 before writing.

## Auth — critical

Auth is established ONCE by `tests/e2e/auth.setup.ts`. Individual tests do NOT perform login.
The `storageState: 'playwright/.auth/user.json'` is set globally in `playwright.config.ts` — do NOT add `test.use({ storageState })` in your test file unless you need a DIFFERENT auth state.

```typescript
import { test, expect } from '@playwright/test'

// storageState already loaded — user is pre-authenticated
test.describe('$ARGUMENTS', () => {
  test('happy path', async ({ page }) => {
    await page.goto('/dashboard')
    // ...
  })
})
```

**Unauthenticated test (exception)**:
```typescript
test('unauthenticated user redirects to login', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/login')
})
```

## File location

All E2E tests live in `tests/e2e/`. Name the file after the flow:
- Upload flow → `invoices-upload.spec.ts`
- Auth guard → `auth-guard.spec.ts`

## Playwright patterns

```typescript
// Redirect assertion
await expect(page).toHaveURL('/dashboard')

// Visible element (auto-waits)
await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible()

// File upload
await page.locator('input[type="file"]').setInputFiles({
  name: 'test.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 test'),
})

// Network error simulation
await page.route('**/api/invoices', route => route.abort('failed'))
```

## Multi-user isolation

When testing that user A cannot access user B's data, use a SEPARATE browser context for user B:

```typescript
test('cannot access another user\'s invoice', async ({ page, context }) => {
  // page is user A (pre-authenticated via storageState)
  // Create a fully isolated context for user B
  const secondCtx = await context.browser()!.newContext()
  const secondPage = await secondCtx.newPage()
  // ... register/login second user, try to access first user's resource
  await secondCtx.close()
})
```

## Env vars

```typescript
process.env['TEST_USER_EMAIL']    // bracket notation required (TS strict)
process.env['TEST_USER_PASSWORD']
process.env['TEST_BASE_URL']      // default: http://localhost:3000
```

## Coverage targets

1. Happy path (core flow with authenticated test user)
2. Error handling (use `page.route()` to simulate server errors)
3. Auth guard (unauthenticated access → redirect)
4. Ownership (if applicable — user A cannot see user B's resource)

## After writing

```bash
# If playwright/.auth/user.json is missing:
npx playwright test --project=setup

# Run the new test
npx playwright test tests/e2e/<your-file>.spec.ts --project=chromium
```

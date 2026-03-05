---
mode: agent
description: Write a Playwright E2E test for a specified user flow
---
Write a Playwright E2E test for: ${input:flowDescription}

Rules:
- Auth is established in `tests/e2e/auth.setup.ts` — never re-login inside the test
- Output: `tests/e2e/${input:flowDescription:kebab}.spec.ts`
- Depend on the `setup` project; use `storageState: 'playwright/.auth/user.json'`
- Avoid hard-coded waits — use `waitForSelector`, `waitForResponse`, or `expect(locator).toBeVisible()`

After writing, run the test with `npx playwright test` and fix any failures.

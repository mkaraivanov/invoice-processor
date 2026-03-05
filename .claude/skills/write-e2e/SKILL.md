---
name: write-e2e
description: Write a Playwright E2E test for a specified flow using the project's auth setup pattern
disable-model-invocation: true
argument-hint: "[flow-description]"
---
Write a Playwright E2E test for: $ARGUMENTS

First read @docs/TESTING_STRATEGY.md for the auth setup pattern.

Rules:
- Auth is established in `tests/e2e/auth.setup.ts` — never re-login inside a test
- Test must depend on the `setup` project and use `storageState: 'playwright/.auth/user.json'`
- Output file: `tests/e2e/$ARGUMENTS.spec.ts` (kebab-case, descriptive name)
- Use the Playwright MCP to run and inspect the test after writing it
- Avoid hard-coded waits — use `waitForSelector`, `waitForResponse`, or `expect(locator).toBeVisible()`

After writing, use the Playwright MCP to run the test and fix any failures.

# Phase 7: Development Workflow

---

## Testing Cycle (Pragmatic TDD)

**Before implementing a feature:**

1. Write a failing E2E test (Playwright) or integration test (Vitest)
   ```bash
   npm run test:e2e -- --grep "should upload invoice"
   ```
2. Watch test fail
3. Implement feature code
4. Test passes ✅
5. Add unit tests for edge cases
6. Commit: `git commit -m "test: add tests for X\nfeat: implement X"`

---

## Local Development Commands

```bash
# Watch all tests
npm run test:watch

# Run specific test suite
npm run test:unit -- tests/repositories

# Run E2E tests in UI mode (interactive debugging)
npm run test:e2e:ui

# Generate coverage report
npm run test:unit -- --coverage
open coverage/index.html
```

---

## Debugging E2E Tests

```bash
# Debug mode (step through test)
npx playwright test tests/e2e/auth.spec.ts --debug

# UI mode (watch test execution)
npx playwright test tests/e2e/auth.spec.ts --ui

# Generate trace for inspection
npx playwright show-trace trace.zip
```

# Phase 1: Installation & Configuration

---

## 1.1 Install Dependencies

```bash
# Testing frameworks
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @playwright/test

# Utilities
npm install -D dotenv

# Next.js testing
npm install -D next-router-mock
```

> **Note**: `vitest-mock-extended` is intentionally omitted — `vi.fn()` + `vi.mocked()` covers all mocking needs here.

---

## 1.2 Create `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    pool: 'forks',       // replaces deprecated threads: false
    maxWorkers: 1,        // sequential execution — avoids DB conflicts
    projects: [          // replaces deprecated environmentMatchGlobs
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
          environment: 'node',
          // Global setup + Supabase mock (unit tests never touch real DB or Supabase)
          setupFiles: ['./tests/setup.ts', './tests/setup.unit.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.spec.ts'],
          environment: 'node',
          // No Supabase mock — integration tests control mocks per-test or use real stubs
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        plugins: [react()],   // JSX transform — required for .tsx test files
        test: {
          name: 'components',
          include: ['tests/components/**/*.spec.tsx'],
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts', './tests/setup.unit.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.stories.tsx',
        'src/app/generated/**',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## 1.3 Create `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['html'],
    // 'github' reporter prints annotation noise locally — only enable in CI
    ...(process.env['CI'] ? [['github']] as const : []),
    ['list'],
  ],
  use: {
    baseURL: process.env['TEST_BASE_URL'] || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env['CI']
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env['CI'],
      },
  projects: [
    // Auth setup runs once before all browser projects
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',  // canonical auth state path
      },
      dependencies: ['setup'],
    },
    // Add Firefox only when cross-browser coverage becomes a deliberate requirement.
    // Running it in CI doubles E2E time with no benefit for this project today.
  ],
})
```

> **Important**: Add the following to `.gitignore` — auth tokens must never be committed:
> ```
> # Playwright auth state (contains live session tokens)
> playwright/.auth/
> ```

---

## 1.4 Create `tests/setup.ts`

Global setup loaded by **all** vitest projects. Handles env loading and the Prisma
lifecycle only. Supabase mocking lives in `tests/setup.unit.ts` (unit + component
projects only) so it never pollutes integration tests.

```typescript
// Load .env.test before any module imports resolve env vars.
// Vitest does NOT auto-load .env.test — this import must come first.
import { config } from 'dotenv'
config({ path: '.env.test' })

import { beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

> **Why no transaction rollback wrapper?**
> `prisma.$transaction(async (tx) => { return tx })` completes immediately — there
> is no live transaction to roll back. Integration tests manage their own cleanup via
> `beforeEach` / `afterEach` `deleteMany` calls (see Section 2.1). This is simpler
> and more reliable at this project's scale.

---

## 1.4b Create `tests/setup.unit.ts`

Loaded only by the `unit` and `components` vitest projects. Mocking Supabase here
(not globally) ensures integration tests can control their own Supabase behaviour
without fighting a blanket mock.

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      })),
    },
  })),
}))
```

---

## 1.5 Create `.env.test`

> Vitest does **not** auto-load `.env.test`. The `config({ path: '.env.test' })` call
> at the top of `tests/setup.ts` handles this. Without it, all env vars will be
> `undefined` in CI.

```env
# Database (test instance)
DATABASE_URL="postgresql://user:password@localhost:5432/invoice_processor_test"
DIRECT_URL="postgresql://user:password@localhost:5432/invoice_processor_test"

# Supabase (test project)
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_TEST_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_TEST_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_TEST_SERVICE_KEY"

# Cron secret
CRON_SECRET="test-secret-key"

# Test-specific
NODE_ENV="test"
TEST_BASE_URL="http://localhost:3000"

# E2E test user credentials (used by auth.setup.ts)
TEST_USER_EMAIL="e2e-test-user@example.com"
TEST_USER_PASSWORD="your-e2e-test-password"
```

---

## 1.6 Update `package.json` Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:vitest": "vitest run tests/unit tests/integration --coverage",
    "test:component": "vitest run tests/components",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test:vitest && npm run test:component && npm run test:e2e",
    "test:watch": "vitest --watch"
  }
}
```

> **Why `test:vitest` not `test:unit`?** The script runs both `tests/unit/` and
> `tests/integration/` directories. Naming it `test:unit` is misleading.

- Add to `package.json` scripts: `"pre-commit": "npm run type-check && npm run lint"`
- Install via husky

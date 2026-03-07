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

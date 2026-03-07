import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import { config } from 'dotenv'

// 1. Load .env.local first (provides DATABASE_URL from Supabase credentials).
// 2. Then load .env.test with override so test-specific vars win.
// Both calls must happen before defineConfig so the env.DATABASE_URL expression
// below reads the correct value at config-parse time.
config({ path: '.env.local' })
config({ path: '.env.test', override: true })

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    pool: 'forks',       // replaces deprecated threads: false
    maxWorkers: 1,        // sequential execution — avoids DB conflicts
    projects: [          // replaces deprecated environmentMatchGlobs
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
          environment: 'node',
          globalSetup: ['./tests/global-setup.ts'],
          // Placeholder DATABASE_URL prevents prisma.ts from throwing at module load time.
          // Unit tests never query the DB — all repos are mocked.
          env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/unit_test_placeholder' },
          // Global setup + Supabase mock (unit tests never touch real DB or Supabase)
          setupFiles: ['./tests/setup.ts', './tests/setup.unit.ts'],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.spec.ts'],
          environment: 'node',
          globalSetup: ['./tests/global-setup.ts'],
          // Fallback DATABASE_URL so prisma.ts doesn't throw at import time when
          // .env.test is absent. Real DB tests (repositories) need .env.test with
          // a real connection string — this placeholder just unblocks API route tests.
          // NODE_TLS_REJECT_UNAUTHORIZED=0: pg strict TLS verification fails against
          // Supabase's certificate chain in local dev; disable only for test workers.
          env: {
            DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://test:test@localhost:5432/integration_test_placeholder',
            NODE_TLS_REJECT_UNAUTHORIZED: '0',
          },
          // No Supabase mock — integration tests control mocks per-test or use real stubs
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        plugins: [react(), tsconfigPaths()],   // JSX transform — required for .tsx test files
        test: {
          name: 'components',
          include: ['tests/components/**/*.spec.tsx'],
          environment: 'jsdom',
          globalSetup: ['./tests/global-setup.ts'],
          env: { DATABASE_URL: 'postgresql://test:test@localhost:5432/unit_test_placeholder' },
          setupFiles: ['./tests/setup.ts', './tests/setup.unit.ts', './tests/setup.components.ts'],
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
      thresholds: {
        // Overall unit/integration target
        lines: 80,
        functions: 80,
        branches: 75,
        // Per-layer targets (Phase 8)
        'src/repositories/**': { lines: 90, functions: 90, branches: 85 },
        'src/services/**': { lines: 85, functions: 85, branches: 80 },
        'src/app/api/**': { lines: 80, functions: 80, branches: 75 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

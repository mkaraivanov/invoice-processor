# Test Automation Strategy — Invoice Processor POC

**Status**: Draft  
**Last Updated**: March 3, 2026  
**Approach**: Pragmatic TDD (tests alongside features)

---

## Executive Summary

Implement a three-tier testing pyramid using **Vitest** (unit + integration), **React Testing Library** (components), and **Playwright** (E2E). Use a real Postgres test database with transaction rollback for isolation, and a real Supabase test project with authentication fixtures. Tests and code develop in parallel. **Target coverage**: ~60% unit/integration, ~30% component, ~10% E2E.

| Layer | Tool | Coverage | Speed | Purpose |
|-------|------|----------|-------|---------|
| **Unit & Integration** | Vitest | 60% | ⚡ Fast | Services, repositories, API routes, utilities |
| **Component** | Vitest + RTL | 30% | ⚡ Fast | React components (Client Components only) |
| **End-to-End** | Playwright | 10% | 🐢 Slow | Critical user flows (auth, upload, processing) |

---

## Architecture Overview

```
tests/
├── unit/
│   ├── repositories/          # Prisma CRUD operations (real DB)
│   │   ├── user.repository.spec.ts
│   │   └── invoice.repository.spec.ts
│   ├── services/              # Business logic (mocked Supabase)
│   │   ├── auth.service.spec.ts
│   │   ├── invoice.service.spec.ts
│   │   └── storage.service.spec.ts
│   └── utils/                 # Utility functions
│       └── validation.spec.ts
├── integration/
│   └── api/                   # API Route Handlers (Next.js)
│       ├── invoices.spec.ts
│       ├── invoices-get.spec.ts
│       └── cron-process.spec.ts
├── components/                # React Component tests (jsdom)
│   ├── LoginPage.spec.tsx
│   ├── RegisterPage.spec.tsx
│   ├── InvoicesPage.spec.tsx
│   └── DashboardPage.spec.tsx
├── e2e/                       # End-to-End tests (real browser)
│   ├── auth.setup.ts          # Runs once: authenticates and saves playwright/.auth/user.json
│   ├── auth.spec.ts
│   ├── auth-login.spec.ts
│   ├── invoices-upload.spec.ts
│   ├── invoices-list.spec.ts
│   ├── auth-guard.spec.ts
│   └── ownership.spec.ts
├── fixtures/                  # Test helpers & mocks
│   ├── auth.fixture.ts
│   ├── db.fixture.ts
│   └── mocks/
│       ├── supabase.mock.ts
│       └── storage.mock.ts
├── setup.ts                   # Global setup: DB connection, transaction hooks
└── playwright.config.ts       # Playwright configuration
```

---

## Phase 1: Installation & Configuration

### 1.1 Install Dependencies

```bash
# Testing frameworks
npm install -D vitest @testing-library/react @testing-library/jest-dom @playwright/test

# Utilities
npm install -D vitest-mock-extended dotenv

# Next.js testing
npm install -D next-router-mock
```

### 1.2 Create `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    pool: 'forks',       // replaces deprecated threads: false
    maxWorkers: 1,        // sequential execution — avoids DB conflicts
    setupFiles: ['./tests/setup.ts'],
    projects: [          // replaces deprecated environmentMatchGlobs
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'components',
          include: ['tests/components/**/*.spec.tsx'],
          environment: 'jsdom',
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
        'src/app/**',
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

### 1.3 Create `playwright.config.ts`

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
    ['github'],
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
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
})
```

> **Note**: Add `playwright/.auth/` to `.gitignore` — auth tokens must never be committed.

### 1.4 Create `tests/setup.ts`

```typescript
import { vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'

// Mock Supabase globally
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
      from: vi.fn(),
    },
  })),
}))

// Test database transaction wrapper
let transactionHandle: any = null

beforeEach(async () => {
  // Start a transaction that will be rolled back after each test
  // This is a simplified approach; consider using @prisma/internals for production
  transactionHandle = await prisma.$transaction(async (tx) => {
    // Return the transaction handle for use in test
    return tx
  })
})

afterEach(async () => {
  // Rollback is implicit when transaction exits
  // Ensure all connections are cleaned up
  await new Promise((resolve) => setTimeout(resolve, 10))
})

// Ensure Prisma client connects
beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```

### 1.5 Create `.env.test`

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

### 1.6 Update `package.json` Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit tests/integration --coverage",
    "test:component": "vitest run tests/components",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test:unit && npm run test:component && npm run test:e2e",
    "test:watch": "vitest --watch"
  }
}
```

---

## Phase 2: Unit & Integration Tests (Vitest)

### 2.1 Repository Tests (Real Database)

**File**: `tests/unit/repositories/user.repository.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { userRepository } from '@/repositories/user.repository'
import { prisma } from '@/lib/prisma'

describe('UserRepository', () => {
  const testUserId = 'test-user-123'
  const testEmail = 'test@example.com'
  const testName = 'Test User'

  beforeEach(async () => {
    // Clean up test data before each test
    await prisma.user.deleteMany({
      where: { id: testUserId },
    })
  })

  describe('upsert', () => {
    it('should create a new user if not exists', async () => {
      const result = await userRepository.upsert(testUserId, testEmail, testName)

      expect(result).toEqual(
        expect.objectContaining({
          id: testUserId,
          email: testEmail,
          fullName: testName,
        })
      )
    })

    it('should update existing user', async () => {
      // Create initial user
      await userRepository.upsert(testUserId, testEmail, 'Old Name')

      // Update with new data
      const result = await userRepository.upsert(testUserId, testEmail, 'New Name')

      expect(result.fullName).toBe('New Name')
    })
  })

  describe('findById', () => {
    it('should return user by ID', async () => {
      await userRepository.upsert(testUserId, testEmail, testName)

      const result = await userRepository.findById(testUserId)

      expect(result).toEqual(expect.objectContaining({ id: testUserId }))
    })

    it('should return null if user not found', async () => {
      const result = await userRepository.findById('nonexistent-id')

      expect(result).toBeNull()
    })
  })

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      await userRepository.upsert(testUserId, testEmail, testName)

      const result = await userRepository.findByEmail(testEmail)

      expect(result).toEqual(expect.objectContaining({ email: testEmail }))
    })
  })
})
```

**File**: `tests/unit/repositories/invoice.repository.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { invoiceRepository } from '@/repositories/invoice.repository'
import { userRepository } from '@/repositories/user.repository'
import { prisma } from '@/lib/prisma'
import { InvoiceStatus } from '@/app/generated/prisma/client'  // ← custom output path; not @prisma/client

describe('InvoiceRepository', () => {
  const testUserId = 'test-user-123'
  const testEmail = 'test@example.com'

  beforeEach(async () => {
    // Setup: create test user
    await userRepository.upsert(testUserId, testEmail)

    // Cleanup: remove test invoices
    await prisma.invoice.deleteMany({
      where: { userId: testUserId },
    })
  })

  describe('create', () => {
    it('should create a new invoice with PENDING status', async () => {
      const result = await invoiceRepository.create({
        userId: testUserId,
        fileName: 'test.pdf',
        storagePath: 'test-user/uuid.pdf',
      })

      expect(result).toEqual(
        expect.objectContaining({
          userId: testUserId,
          fileName: 'test.pdf',
          status: InvoiceStatus.PENDING,
          processedAt: null,
        })
      )
    })
  })

  describe('findById', () => {
    it('should return invoice with user details', async () => {
      const created = await invoiceRepository.create({
        userId: testUserId,
        fileName: 'test.pdf',
        storagePath: 'path/to/file.pdf',
      })

      const result = await invoiceRepository.findById(created.id)

      expect(result).toEqual(expect.objectContaining({ id: created.id }))
      expect(result?.user).toEqual(expect.objectContaining({ id: testUserId }))
    })
  })

  describe('findByUserId', () => {
    it('should return user invoices', async () => {
      await invoiceRepository.create({
        userId: testUserId,
        fileName: 'invoice1.pdf',
        storagePath: 'path/1.pdf',
      })
      await invoiceRepository.create({
        userId: testUserId,
        fileName: 'invoice2.pdf',
        storagePath: 'path/2.pdf',
      })

      const result = await invoiceRepository.findByUserId(testUserId)

      expect(result).toHaveLength(2)
    })
  })

  describe('updateStatus', () => {
    it('should update invoice status and set processedAt if COMPLETED', async () => {
      const invoice = await invoiceRepository.create({
        userId: testUserId,
        fileName: 'test.pdf',
        storagePath: 'path/file.pdf',
      })

      const result = await invoiceRepository.updateStatus(invoice.id, InvoiceStatus.COMPLETED, {
        vendor: 'Test Vendor',
        amount: 100.0,
      })

      expect(result.status).toBe(InvoiceStatus.COMPLETED)
      expect(result.processedAt).not.toBeNull()
      expect(result.extractedData).toEqual({ vendor: 'Test Vendor', amount: 100.0 })
    })
  })

  describe('findPending', () => {
    it('should return pending invoices up to limit', async () => {
      for (let i = 0; i < 3; i++) {
        await invoiceRepository.create({
          userId: testUserId,
          fileName: `invoice${i}.pdf`,
          storagePath: `path/${i}.pdf`,
        })
      }

      const result = await invoiceRepository.findPending(2)

      expect(result).toHaveLength(2)
      expect(result.every((inv) => inv.status === InvoiceStatus.PENDING)).toBe(true)
    })
  })
})
```

### 2.2 Service Tests (Mocked Supabase)

**File**: `tests/unit/services/auth.service.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from '@/services/auth.service'
import { userRepository } from '@/repositories/user.repository'
import * as supabaseModule from '@/lib/supabase/server'

vi.mock('@/repositories/user.repository')
vi.mock('@/lib/supabase/server')

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('signUp', () => {
    it('should create user via Supabase and repository', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockClient = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      }

      vi.mocked(supabaseModule.createClient).mockResolvedValue(mockClient as any)
      vi.mocked(userRepository.upsert).mockResolvedValue(mockUser as any)

      const result = await authService.signUp({
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User',
      })

      expect(mockClient.auth.signUp).toHaveBeenCalled()
      expect(userRepository.upsert).toHaveBeenCalledWith('user-123', 'test@example.com', 'Test User')
      expect(result).toEqual(mockUser)
    })

    it('should throw error if signUp fails', async () => {
      const mockClient = {
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'User already exists' },
          }),
        },
      }

      vi.mocked(supabaseModule.createClient).mockResolvedValue(mockClient as any)

      await expect(
        authService.signUp({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('User already exists')
    })
  })

  describe('getUser', () => {
    it('should return authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      }

      vi.mocked(supabaseModule.createClient).mockResolvedValue(mockClient as any)

      const result = await authService.getUser()

      expect(result).toEqual(mockUser)
    })

    it('should return null if user not authenticated', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      }

      vi.mocked(supabaseModule.createClient).mockResolvedValue(mockClient as any)

      const result = await authService.getUser()

      expect(result).toBeNull()
    })
  })
})
```

**File**: `tests/unit/services/invoice.service.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoiceService } from '@/services/invoice.service'
import { invoiceRepository } from '@/repositories/invoice.repository'
import { storageService } from '@/services/storage.service'

vi.mock('@/repositories/invoice.repository')
vi.mock('@/services/storage.service')

describe('InvoiceService', () => {
  const testUserId = 'user-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadInvoice', () => {
    it('should upload file and create invoice record', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      const mockStoragePath = 'user-123/uuid.pdf'
      const mockInvoice = {
        id: 'inv-123',
        userId: testUserId,
        fileName: 'test.pdf',
        storagePath: mockStoragePath,
        status: 'PENDING',
      }

      vi.mocked(storageService.uploadInvoiceFile).mockResolvedValue(mockStoragePath)
      vi.mocked(invoiceRepository.create).mockResolvedValue(mockInvoice as any)

      const result = await invoiceService.uploadInvoice(testUserId, { file: mockFile })

      expect(storageService.uploadInvoiceFile).toHaveBeenCalledWith(testUserId, mockFile)
      expect(invoiceRepository.create).toHaveBeenCalled()
      expect(result).toEqual(mockInvoice)
    })

    it('should reject files larger than 10MB', async () => {
      const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'large.pdf')

      await expect(invoiceService.uploadInvoice(testUserId, { file: largeFile })).rejects.toThrow(
        'File must be smaller than 10MB'
      )
    })
  })

  describe('processInvoice', () => {
    it('should process invoice and extract mock data', async () => {
      const mockInvoice = {
        id: 'inv-123',
        userId: testUserId,
        status: 'PENDING',
      }

      vi.mocked(invoiceRepository.findById).mockResolvedValue(mockInvoice as any)
      vi.mocked(invoiceRepository.updateStatus).mockResolvedValue({
        ...mockInvoice,
        status: 'COMPLETED',
      } as any)

      const result = await invoiceService.processInvoice('inv-123')

      expect(result.status).toBe('COMPLETED')
      expect(result.data).toBeDefined()
    })
  })

  describe('getUserInvoices', () => {
    it('should fetch user invoices', async () => {
      const mockInvoices = [
        { id: 'inv-1', fileName: 'invoice1.pdf' },
        { id: 'inv-2', fileName: 'invoice2.pdf' },
      ]

      vi.mocked(invoiceRepository.findByUserId).mockResolvedValue(mockInvoices as any)

      const result = await invoiceService.getUserInvoices(testUserId)

      expect(invoiceRepository.findByUserId).toHaveBeenCalledWith(testUserId)
      expect(result).toEqual(mockInvoices)
    })
  })
})
```

### 2.3 API Route Tests

**File**: `tests/integration/api/invoices.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from '@/app/api/invoices/route'
import { NextRequest } from 'next/server'
import * as authService from '@/services/auth.service'
import * as invoiceService from '@/services/invoice.service'

vi.mock('@/services/auth.service')
vi.mock('@/services/invoice.service')

describe('POST /api/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if user not authenticated', async () => {
    vi.mocked(authService.authService.getUser).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/invoices', {
      method: 'POST',
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('should upload invoice for authenticated user', async () => {
    const mockFile = new File(['content'], 'test.pdf')
    const mockUser = { id: 'user-123' }
    const mockInvoice = { id: 'inv-123', fileName: 'test.pdf' }

    vi.mocked(authService.authService.getUser).mockResolvedValue(mockUser as any)
    vi.mocked(invoiceService.invoiceService.uploadInvoice).mockResolvedValue(mockInvoice as any)

    const formData = new FormData()
    formData.append('file', mockFile)

    const request = new NextRequest('http://localhost:3000/api/invoices', {
      method: 'POST',
      body: formData,
    })

    const response = await POST(request)

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data).toEqual(mockInvoice)
  })
})

describe('GET /api/invoices', () => {
  it('should return 401 if not authenticated', async () => {
    vi.mocked(authService.authService.getUser).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/invoices', {
      method: 'GET',
    })

    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('should list user invoices', async () => {
    const mockUser = { id: 'user-123' }
    const mockInvoices = [{ id: 'inv-1' }, { id: 'inv-2' }]

    vi.mocked(authService.authService.getUser).mockResolvedValue(mockUser as any)
    vi.mocked(invoiceService.invoiceService.getUserInvoices).mockResolvedValue(
      mockInvoices as any
    )

    const request = new NextRequest('http://localhost:3000/api/invoices', {
      method: 'GET',
    })

    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual(mockInvoices)
  })
})
```

---

## Phase 3: Component Tests (React Testing Library)

**File**: `tests/components/LoginPage.spec.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from '@/app/(auth)/login/page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
    },
  }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render login form', () => {
    render(<LoginPage />)

    expect(screen.getByText(/login/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('should show error message on failed login', async () => {
    const mockCreateClient = vi.fn()
    vi.mocked(mockCreateClient).mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Invalid credentials' },
        }),
      },
    } as any)

    render(<LoginPage />)

    const emailInput = screen.getByLabelText(/email/i)
    const passwordInput = screen.getByLabelText(/password/i)
    const submitButton = screen.getByRole('button', { name: /login/i })

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(passwordInput, { target: { value: 'wrong' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    })
  })

  it('should have link to register page', () => {
    render(<LoginPage />)

    const registerLink = screen.getByRole('link', { name: /register/i })
    expect(registerLink).toHaveAttribute('href', '/register')
  })
})
```

**File**: `tests/components/DashboardPage.spec.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from '@/app/(protected)/dashboard/page'

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'COMPLETED' },
        { id: '3', status: 'FAILED' },
      ],
    })
  })

  it('should render dashboard heading', () => {
    render(<DashboardPage />)

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
  })

  it('should display invoice statistics', async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument() // Total
      expect(screen.getByText('1')).toBeInTheDocument() // Pending
    })
  })

  it('should show upload link', () => {
    render(<DashboardPage />)

    const uploadLink = screen.getByRole('link', { name: /upload/i })
    expect(uploadLink).toHaveAttribute('href', '/invoices')
  })
})
```

---

## Phase 4: End-to-End Tests (Playwright)

### 4.0 Create `tests/e2e/auth.setup.ts` (runs once before browser projects)

Auth state is established by a dedicated **setup project** — not inside a test — so browsers start pre-authenticated.

```typescript
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '../../playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env['TEST_USER_EMAIL']!)
  await page.fill('input[name="password"]', process.env['TEST_USER_PASSWORD']!)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
  await page.context().storageState({ path: authFile })
})
```

**File**: `tests/e2e/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should register new user and redirect to dashboard', async ({ page }) => {
    await page.goto('/register')

    // Fill registration form
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[name="fullName"]', 'Test User')
    await page.fill('input[name="password"]', 'password123')

    // Submit form
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('should login existing user', async ({ page }) => {
    // Use pre-created test user (stored in .env.test)
    const testEmail = process.env['TEST_USER_EMAIL']
    const testPassword = process.env['TEST_USER_PASSWORD']

    await page.goto('/login')

    await page.fill('input[name="email"]', testEmail)
    await page.fill('input[name="password"]', testPassword)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/dashboard')
    // Auth state is saved by auth.setup.ts — do not save it here
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.locator('text=/invalid|unauthorized/i')).toBeVisible()
  })

  test('unauthenticated user should redirect to login', async ({ page, context }) => {
    // Clear any existing session
    await context.clearCookies()

    await page.goto('/dashboard')

    // Should redirect to login
    await expect(page).toHaveURL('/login')
  })
})
```

**File**: `tests/e2e/invoices-upload.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Invoice Upload', () => {
  // Use authenticated session from previous test
  test.use({
    storageState: 'playwright/.auth/user.json',
  })

  test('should upload invoice and show in list', async ({ page }) => {
    await page.goto('/invoices')

    // Create a test file
    const fileName = `test-${Date.now()}.pdf`
    const fileContent = Buffer.from('PDF content')

    // Upload file
    const fileInput = await page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'application/pdf',
      buffer: fileContent,
    })

    // Wait for upload to complete
    await expect(page.locator(`text=${fileName}`)).toBeVisible()

    // Verify invoice appears in list with PENDING status
    await expect(page.locator('text=PENDING')).toBeVisible()
  })

  test('should reject files larger than 10MB', async ({ page }) => {
    await page.goto('/invoices')

    // TODO: Implement file size test
    // Note: Hard to test large files in Playwright; mock in unit tests instead
  })

  test('should show error on upload failure', async ({ page }) => {
    await page.goto('/invoices')

    // Simulate upload failure by intercepting request
    await page.route('**/api/invoices', (route) => {
      route.abort('failed')
    })

    const fileInput = await page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('content'),
    })

    // Should show error message
    await expect(page.locator('text=/upload failed/i')).toBeVisible()
  })
})
```

**File**: `tests/e2e/invoices-list.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Invoice List', () => {
  test.use({
    storageState: 'playwright/.auth/user.json',
  })

  test('should display list of invoices', async ({ page }) => {
    await page.goto('/invoices')

    // Verify page loads
    await expect(page.locator('text=Invoices')).toBeVisible()
    await expect(page.locator('text=Upload')).toBeVisible()
  })

  test('should navigate to invoice detail page', async ({ page }) => {
    await page.goto('/invoices')

    // Click on first invoice in list
    const firstInvoice = page.locator('table tbody tr').first()
    await firstInvoice.click()

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/invoices\/[a-z0-9-]+/)
    await expect(page.locator('text=Extracted Data')).toBeVisible({ timeout: 1000 }).catch(() => {
      // Detail page may not have extracted data yet
    })
  })

  test('should auto-refresh invoice list while processing', async ({ page }) => {
    await page.goto('/invoices')

    // Verify list updates periodically
    const listBefore = await page.locator('table tbody').innerHTML()

    // Wait 10+ seconds for auto-refresh
    await page.waitForTimeout(12000)

    const listAfter = await page.locator('table tbody').innerHTML()

    // Lists may be the same or different depending on invoice processing
    expect(typeof listBefore).toBe('string')
    expect(typeof listAfter).toBe('string')
  })
})
```

**File**: `tests/e2e/ownership.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test.describe('Invoice Ownership', () => {
  test.use({
    storageState: 'playwright/.auth/user.json',
  })

  test('should not access other user invoices', async ({ page, context }) => {
    // Get first user's invoice ID
    await page.goto('/invoices')
    const invoiceLink = page.locator('a[href*="/invoices/"]').first()
    const invoiceUrl = await invoiceLink.getAttribute('href')
    const invoiceId = invoiceUrl?.split('/').pop()

    // Create a new user session
    const newContext = await context.browser()!.newContext()
    const newPage = newContext.newPage()

    // Register second user
    const secondUserEmail = `test2-${Date.now()}@example.com`
    await newPage.goto('/register')
    await newPage.fill('input[name="email"]', secondUserEmail)
    await newPage.fill('input[name="fullName"]', 'Second User')
    await newPage.fill('input[name="password"]', 'password123')
    await newPage.click('button[type="submit"]')
    await expect(newPage).toHaveURL('/dashboard')

    // Try to access first user's invoice
    await newPage.goto(`/invoices/${invoiceId}`)

    // Should show error or redirect
    await expect(newPage.locator('text=/not found|unauthorized/i')).toBeVisible()

    await newContext.close()
  })
})
```

---

## Phase 5: Test Fixtures & Helpers

**File**: `tests/fixtures/auth.fixture.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!
)

export async function createTestUser(
  email: string,
  password: string
): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) throw new Error(`Failed to create test user: ${error.message}`)

  return { id: data.user!.id, email: data.user!.email! }
}

export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) throw new Error(`Failed to delete test user: ${error.message}`)
}

export async function createTestSession(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw new Error(`Failed to create session: ${error.message}`)

  return data.session!
}
```

**File**: `tests/fixtures/mocks/supabase.mock.ts`

```typescript
import { vi } from 'vitest'

export const mockSupabaseClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getUser: vi.fn(),
    admin: {
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
  from: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      download: vi.fn(),
      createSignedUrl: vi.fn(),
      remove: vi.fn(),
    })),
  },
}

export function resetSupabaseMocks() {
  Object.values(mockSupabaseClient.auth).forEach((method) => {
    if (typeof method === 'object' && 'mockClear' in method) {
      method.mockClear()
    }
  })
}
```

**File**: `tests/fixtures/mocks/storage.mock.ts`

```typescript
import { vi } from 'vitest'

export const mockStorageService = {
  uploadInvoiceFile: vi.fn(async (userId: string, file: File) => {
    return `${userId}/${Math.random().toString(36).substring(7)}`
  }),

  getSignedUrl: vi.fn(async (path: string) => {
    return `https://example.supabase.co/storage/signed/${path}`
  }),

  deleteFile: vi.fn(async (path: string) => {
    // noop
  }),
}
```

---

## Phase 6: CI/CD Pipeline (GitHub Actions)

**File**: `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: invoice_processor_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - run: npm ci

      - name: Setup database
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/invoice_processor_test
        run: |
          npx prisma migrate deploy

      - name: Run unit & integration tests
        run: npm run test:unit -- --coverage

      - name: Run component tests
        run: npm run test:component -- --coverage

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        env:
          TEST_BASE_URL: http://localhost:3000
        run: npm run test:e2e

      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella

      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Phase 7: Development Workflow

### Testing Cycle (Pragmatic TDD)

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

### Local Development

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

### Debugging E2E Tests

```bash
# Debug mode (step through test)
npx playwright test tests/e2e/auth.spec.ts --debug

# UI mode (watch test execution)
npx playwright test tests/e2e/auth.spec.ts --ui

# Generate trace for inspection
npx playwright show-trace trace.zip
```

---

## Phase 8: Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| **Repositories** | 90%+ | Critical data access layer; high impact bugs |
| **Services** | 85%+ | Business logic; test mocked Supabase |
| **API Routes** | 80%+ | Request/response handling; auth validation |
| **Components** | 60%+ | UI interactions; avoid over-testing styling |
| **E2E** | 100% critical paths | Register, Login, Upload, Detail page access |

**Total project target**: 80% overall unit/integration, 50% components, 10% E2E coverage by time invested.

---

## Phase 9: Verification Checklist

- [ ] `npm run test:unit` passes with ≥80% coverage
- [ ] `npm run test:component` passes
- [ ] `npm run test:e2e` passes locally
- [ ] GitHub Actions workflow runs on PR, blocks merge on failure
- [ ] Playwright traces saved in CI artifacts on failure
- [ ] Test database resets cleanly between runs
- [ ] `npm run test:watch` works for interactive development
- [ ] Mocks are reset between tests (no state leaks)
- [ ] Mock modules match real interface signatures

---

## Key Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| **Pragmatic TDD** | Tests alongside features = faster iteration while maintaining quality |
| **Real test Postgres** | Catches schema/constraint violations; transactions isolate tests |
| **Mock Supabase in unit tests** | Speeds up tests; integration tested via E2E |
| **Server Components via E2E only** | Avoids complexity of testing async RSC; verified through full request cycle |
| **Playwright + Vitest split** | Playwright for browser automation; Vitest for fast feedback loop |
| **GitHub Actions matrix** | Ensures compatibility across Node versions |
| **Playwright `setup` project for E2E auth** | Dedicated `auth.setup.ts` runs once before browser projects; session saved to `playwright/.auth/user.json`; avoids mid-test auth side-effects |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Tests hang on DB transaction** | Increase timeout in `vitest.config.ts`; check for unfinished queries |
| **Supabase mock not working** | Ensure `vi.mock()` is top-level in test file; check import path |
| **Playwright timeout** | Increase `timeout` in `playwright.config.ts`; check server logs |
| **Session state leak between tests** | Verify `afterEach` cleanup runs; check `vi.clearAllMocks()` |
| **Coverage not updating** | Delete `coverage/` folder; re-run with `--coverage` flag |

---

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing/)
- [Supabase Testing](https://supabase.com/docs/guides/auth/auth-helpers/nextjs#testing)

---

**Next Steps**: 
1. Install dependencies (Phase 1)
2. Create config files (vitest.config.ts, playwright.config.ts)
3. Implement repository tests first (Phase 2.1)
4. Build service tests on top (Phase 2.2)
5. Write component tests (Phase 3)
6. Add E2E tests for critical paths (Phase 4)
7. Set up CI/CD (Phase 6)
8. Begin feature implementation using pragmatic TDD workflow

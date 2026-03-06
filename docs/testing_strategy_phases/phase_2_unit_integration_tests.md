# Phase 2: Unit & Integration Tests (Vitest)

> **Schema location**: All Zod schemas and DTOs live in `src/types/index.ts`.
> Any import that references `@/schemas/` is wrong — use `@/types` instead.

---

## 2.1 Repository Tests (Real Database)

Repository tests use a real database. They belong in `tests/integration/repositories/`
(mapped to the `integration` vitest project) — **not** `tests/unit/`. The `unit`
project has no DB access.

Each test file manages its own cleanup in `beforeEach` via `deleteMany`. There is no
transaction rollback wrapper — `prisma.$transaction(async (tx) => { return tx })`
completes immediately and cannot roll back after the fact.

**File**: `tests/integration/repositories/user.repository.spec.ts`

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

**File**: `tests/integration/repositories/invoice.repository.spec.ts`

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
    // Cleanup invoices first (FK constraint), then user
    await prisma.invoice.deleteMany({ where: { userId: testUserId } })
    // Ensure test user exists
    await userRepository.upsert(testUserId, testEmail)
  })

  describe('create', () => {
    it('should create a new invoice with PENDING status', async () => {
      const result = await invoiceRepository.create({
        userId: testUserId,
        fileName: 'test.pdf',
        fileUrl: 'test-user/uuid.pdf',  // ← field is fileUrl, not storagePath
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
        fileUrl: 'path/to/file.pdf',
      })

      const result = await invoiceRepository.findById(created.id)

      expect(result).toEqual(expect.objectContaining({ id: created.id }))
      expect(result?.user).toEqual(expect.objectContaining({ id: testUserId }))
    })
  })

  describe('findByUserId', () => {
    it('should return user invoices', async () => {
      await invoiceRepository.create({ userId: testUserId, fileName: 'invoice1.pdf', fileUrl: 'path/1.pdf' })
      await invoiceRepository.create({ userId: testUserId, fileName: 'invoice2.pdf', fileUrl: 'path/2.pdf' })

      const result = await invoiceRepository.findByUserId(testUserId)

      expect(result).toHaveLength(2)
    })
  })

  describe('updateStatus', () => {
    it('should update invoice status and set processedAt if COMPLETED', async () => {
      const invoice = await invoiceRepository.create({
        userId: testUserId,
        fileName: 'test.pdf',
        fileUrl: 'path/file.pdf',
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
    it('should return PENDING invoices up to limit', async () => {
      for (let i = 0; i < 3; i++) {
        await invoiceRepository.create({
          userId: testUserId,
          fileName: `invoice${i}.pdf`,
          fileUrl: `path/${i}.pdf`,
        })
      }

      const result = await invoiceRepository.findPending(2)

      expect(result).toHaveLength(2)
      expect(result.every((inv) => inv.status === InvoiceStatus.PENDING)).toBe(true)
    })

    it('should reclaim PROCESSING invoices stale for more than 5 minutes', async () => {
      const staleInvoice = await invoiceRepository.create({
        userId: testUserId,
        fileName: 'stale.pdf',
        fileUrl: 'path/stale.pdf',
      })

      // Force-set status to PROCESSING with a processingStartedAt older than 5 min
      const staleTimestamp = new Date(Date.now() - 6 * 60 * 1000)
      await prisma.invoice.update({
        where: { id: staleInvoice.id },
        data: { status: 'PROCESSING', processingStartedAt: staleTimestamp },
      })

      const result = await invoiceRepository.findPending(5)

      expect(result.some((inv) => inv.id === staleInvoice.id)).toBe(true)
    })

    it('should NOT return PROCESSING invoices that are still within the 5-minute window', async () => {
      const activeInvoice = await invoiceRepository.create({
        userId: testUserId,
        fileName: 'active.pdf',
        fileUrl: 'path/active.pdf',
      })

      // Set status to PROCESSING with a recent timestamp
      await prisma.invoice.update({
        where: { id: activeInvoice.id },
        data: { status: 'PROCESSING', processingStartedAt: new Date() },
      })

      const result = await invoiceRepository.findPending(5)

      expect(result.some((inv) => inv.id === activeInvoice.id)).toBe(false)
    })
  })
})
```

---

## 2.2 Service Tests (Mocked Dependencies)

Service tests live in `tests/unit/services/` and mock all repositories + Supabase.
The `unit` vitest project loads `tests/setup.unit.ts` which provides the global
Supabase mock; individual tests can override it per-test as needed.

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
      // authService.signUp returns `data` ({ user, session }), not just `user`
      expect(result).toEqual({ user: mockUser })
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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
      const mockFileUrl = 'user-123/uuid.pdf'
      const mockInvoice = {
        id: 'inv-123',
        userId: testUserId,
        fileName: 'test.pdf',
        fileUrl: mockFileUrl,   // ← invoiceRepository.create uses fileUrl, not storagePath
        status: 'PENDING',
      }

      vi.mocked(storageService.uploadInvoiceFile).mockResolvedValue(mockFileUrl)
      vi.mocked(invoiceRepository.create).mockResolvedValue(mockInvoice as any)

      const result = await invoiceService.uploadInvoice(testUserId, { file: mockFile })

      expect(storageService.uploadInvoiceFile).toHaveBeenCalledWith(testUserId, mockFile)
      expect(invoiceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: testUserId, fileName: 'test.pdf', fileUrl: mockFileUrl })
      )
      expect(result).toEqual(mockInvoice)
    })

    it('should reject files larger than 10MB', async () => {
      // Must include a valid MIME type — the Zod schema checks type BEFORE size.
      // A File with no type would fail the type check first, not the size check.
      const largeFile = new File(
        [new ArrayBuffer(11 * 1024 * 1024)],
        'large.pdf',
        { type: 'application/pdf' }
      )

      await expect(invoiceService.uploadInvoice(testUserId, { file: largeFile })).rejects.toThrow(
        'File must be smaller than 10MB'
      )
    })

    it('should reject files with disallowed MIME types', async () => {
      const textFile = new File(['content'], 'data.txt', { type: 'text/plain' })

      await expect(invoiceService.uploadInvoice(testUserId, { file: textFile })).rejects.toThrow(
        'File must be PDF, PNG, or JPG'
      )
    })
  })

  describe('processInvoice', () => {
    it('should claim invoice, process it, and return COMPLETED result', async () => {
      // processInvoice calls claimForProcessing then updateStatus.
      // It does NOT call findById — mocking findById has no effect here.
      vi.mocked(invoiceRepository.claimForProcessing).mockResolvedValue({ id: 'inv-123' } as any)
      vi.mocked(invoiceRepository.updateStatus).mockResolvedValue({
        id: 'inv-123',
        status: 'COMPLETED',
      } as any)

      // The function has a hardcoded 2-second delay — use fake timers to skip it.
      vi.useFakeTimers()
      const resultPromise = invoiceService.processInvoice('inv-123')
      await vi.runAllTimersAsync()
      const result = await resultPromise
      vi.useRealTimers()

      expect(invoiceRepository.claimForProcessing).toHaveBeenCalledWith('inv-123')
      expect(invoiceRepository.updateStatus).toHaveBeenCalledWith(
        'inv-123',
        'COMPLETED',
        expect.any(Object)
      )
      expect(result?.status).toBe('COMPLETED')
      expect(result?.data).toBeDefined()
    })

    it('should return null if invoice is already claimed by another worker', async () => {
      vi.mocked(invoiceRepository.claimForProcessing).mockResolvedValue(null)

      const result = await invoiceService.processInvoice('inv-123')

      expect(result).toBeNull()
      expect(invoiceRepository.updateStatus).not.toHaveBeenCalled()
    })
  })

  describe('getInvoice', () => {
    it('should return invoice when user is the owner', async () => {
      const mockInvoice = { id: 'inv-123', userId: testUserId, fileName: 'test.pdf' }
      vi.mocked(invoiceRepository.findById).mockResolvedValue(mockInvoice as any)

      const result = await invoiceService.getInvoice('inv-123', testUserId)

      expect(result).toEqual(mockInvoice)
    })

    it('should throw Unauthorized when a different user tries to access the invoice', async () => {
      const mockInvoice = { id: 'inv-123', userId: 'owner-456', fileName: 'test.pdf' }
      vi.mocked(invoiceRepository.findById).mockResolvedValue(mockInvoice as any)

      await expect(invoiceService.getInvoice('inv-123', 'attacker-789')).rejects.toThrow(
        'Unauthorized'
      )
    })

    it('should throw if invoice does not exist', async () => {
      vi.mocked(invoiceRepository.findById).mockResolvedValue(null)

      await expect(invoiceService.getInvoice('nonexistent', testUserId)).rejects.toThrow(
        'Invoice not found'
      )
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

  describe('processPendingInvoices', () => {
    it('should bail out before Vercel timeout when elapsed time exceeds 8 seconds', async () => {
      // Two invoices — only the first should be processed before the guard triggers.
      const pendingInvoices = [
        { id: 'inv-1' },
        { id: 'inv-2' },
      ]
      vi.mocked(invoiceRepository.findPending).mockResolvedValue(pendingInvoices as any)

      // Make claimForProcessing succeed for both
      vi.mocked(invoiceRepository.claimForProcessing).mockResolvedValue({ id: 'inv-1' } as any)
      vi.mocked(invoiceRepository.updateStatus).mockResolvedValue({} as any)

      // Fake Date.now so the elapsed check triggers after the first invoice
      let callCount = 0
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount++
        // First call (startTime): 0, second call (loop check): 9000ms > 8000ms threshold
        return callCount === 1 ? 0 : 9000
      })

      vi.useFakeTimers()
      const resultPromise = invoiceService.processPendingInvoices()
      await vi.runAllTimersAsync()
      const result = await resultPromise
      vi.useRealTimers()
      vi.restoreAllMocks()

      // Second invoice skipped because elapsed > 8000
      expect(result.processed).toBe(0) // first was skipped immediately by guard
    })
  })
})
```

---

## 2.3 API Route Tests

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
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
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

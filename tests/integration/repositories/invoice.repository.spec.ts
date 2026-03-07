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

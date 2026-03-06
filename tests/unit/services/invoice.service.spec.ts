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
      vi.mocked(invoiceRepository.claimForProcessing).mockResolvedValue(null as any)

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
      // Two invoices — the guard triggers BEFORE the first invoice is processed.
      const pendingInvoices = [
        { id: 'inv-1' },
        { id: 'inv-2' },
      ]
      vi.mocked(invoiceRepository.findPending).mockResolvedValue(pendingInvoices as any)

      // Fake Date.now so the elapsed check triggers on the first loop iteration.
      // No fake timers needed — the guard breaks before processInvoice (and its
      // 2-second setTimeout) is ever called, so there are no timers to advance.
      let callCount = 0
      vi.spyOn(Date, 'now').mockImplementation(() => {
        callCount++
        // First call (startTime): 0, second call (loop check): 9000ms > 8000ms threshold
        return callCount === 1 ? 0 : 9000
      })

      const result = await invoiceService.processPendingInvoices()
      vi.restoreAllMocks()

      // All invoices skipped because elapsed > 8000 on first iteration
      expect(result.processed).toBe(0)
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/cron/process-invoices/route'
import { NextRequest } from 'next/server'
import * as invoiceServiceModule from '@/services/invoice.service'

vi.mock('@/services/invoice.service')

const VALID_SECRET = 'test-cron-secret'

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/process-invoices', {
    method: 'GET',
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

describe('GET /api/cron/process-invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', VALID_SECRET)
  })

  describe('authorization', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const response = await GET(makeRequest())

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 when secret is wrong', async () => {
      const response = await GET(makeRequest('Bearer wrong-secret'))

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 when Authorization scheme is not Bearer', async () => {
      const response = await GET(makeRequest(`Basic ${VALID_SECRET}`))

      expect(response.status).toBe(401)
    })

    it('should return 401 when CRON_SECRET env var is not set', async () => {
      vi.unstubAllEnvs()

      const response = await GET(makeRequest(`Bearer ${VALID_SECRET}`))

      expect(response.status).toBe(401)
    })
  })

  describe('processing', () => {
    it('should process pending invoices and return result', async () => {
      const mockResult = { processed: 3, failed: 0 }
      vi.mocked(invoiceServiceModule.invoiceService.processPendingInvoices).mockResolvedValue(
        mockResult as any
      )

      const response = await GET(makeRequest(`Bearer ${VALID_SECRET}`))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual(mockResult)
      expect(invoiceServiceModule.invoiceService.processPendingInvoices).toHaveBeenCalledOnce()
    })

    it('should return 500 when processing throws', async () => {
      vi.mocked(invoiceServiceModule.invoiceService.processPendingInvoices).mockRejectedValue(
        new Error('DB connection lost')
      )

      const response = await GET(makeRequest(`Bearer ${VALID_SECRET}`))

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Processing failed')
    })
  })
})

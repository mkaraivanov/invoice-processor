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
    // Verify the session user's ID — not a caller-supplied value — is passed to the service
    expect(invoiceService.invoiceService.uploadInvoice).toHaveBeenCalledWith('user-123', expect.any(Object))
  })
})

describe('GET /api/invoices', () => {
  it('should return 401 if not authenticated', async () => {
    vi.mocked(authService.authService.getUser).mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
  })

  it('should list user invoices', async () => {
    const mockUser = { id: 'user-123' }
    const mockInvoices = [{ id: 'inv-1' }, { id: 'inv-2' }]

    vi.mocked(authService.authService.getUser).mockResolvedValue(mockUser as any)
    vi.mocked(invoiceService.invoiceService.getUserInvoices).mockResolvedValue(
      mockInvoices as any
    )

    const response = await GET()

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual(mockInvoices)
    // Verify the session user's ID is passed to the service (not a caller-supplied value)
    expect(invoiceService.invoiceService.getUserInvoices).toHaveBeenCalledWith('user-123')
  })
})

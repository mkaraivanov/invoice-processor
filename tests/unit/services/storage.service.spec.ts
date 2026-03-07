import { describe, it, expect, vi, beforeEach } from 'vitest'
import { storageService } from '@/services/storage.service'
import * as supabaseModule from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server')

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('uploadInvoiceFile', () => {
    it('should upload file and return storage path', async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: 'user-123/abc.pdf' },
        error: null,
      })
      vi.mocked(supabaseModule.createClient).mockResolvedValue({
        storage: { from: vi.fn(() => ({ upload: mockUpload })) },
      } as any)

      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' })
      const result = await storageService.uploadInvoiceFile('user-123', file)

      expect(mockUpload).toHaveBeenCalled()
      expect(result).toMatch(/^user-123\/.+\.pdf$/)
    })

    it('should throw when upload fails', async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'bucket not found' },
      })
      vi.mocked(supabaseModule.createClient).mockResolvedValue({
        storage: { from: vi.fn(() => ({ upload: mockUpload })) },
      } as any)

      const file = new File(['content'], 'invoice.pdf', { type: 'application/pdf' })

      await expect(storageService.uploadInvoiceFile('user-123', file)).rejects.toThrow(
        'Storage upload failed: bucket not found'
      )
    })

    it('should throw for disallowed file extension', async () => {
      vi.mocked(supabaseModule.createClient).mockResolvedValue({} as any)

      const file = new File(['content'], 'malware.exe', { type: 'application/octet-stream' })

      await expect(storageService.uploadInvoiceFile('user-123', file)).rejects.toThrow(
        'File extension must be pdf, png, jpg, or jpeg'
      )
    })

    it('should allow png and jpg extensions', async () => {
      const mockUpload = vi.fn().mockResolvedValue({
        data: { path: 'user-123/abc.png' },
        error: null,
      })
      vi.mocked(supabaseModule.createClient).mockResolvedValue({
        storage: { from: vi.fn(() => ({ upload: mockUpload })) },
      } as any)

      const file = new File(['content'], 'photo.png', { type: 'image/png' })
      const result = await storageService.uploadInvoiceFile('user-123', file)

      expect(result).toMatch(/^user-123\/.+\.png$/)
    })
  })

  describe('getSignedUrl', () => {
    it('should return a signed URL', async () => {
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.supabase.co/signed/path/to/file.pdf' },
        error: null,
      })
      vi.mocked(supabaseModule.createClient).mockResolvedValue({
        storage: { from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) },
      } as any)

      const result = await storageService.getSignedUrl('path/to/file.pdf')

      expect(mockCreateSignedUrl).toHaveBeenCalledWith('path/to/file.pdf', 3600)
      expect(result).toBe('https://example.supabase.co/signed/path/to/file.pdf')
    })

    it('should use custom expiry when provided', async () => {
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://example.supabase.co/signed/file.pdf' },
        error: null,
      })
      vi.mocked(supabaseModule.createClient).mockResolvedValue({
        storage: { from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) },
      } as any)

      await storageService.getSignedUrl('file.pdf', 7200)

      expect(mockCreateSignedUrl).toHaveBeenCalledWith('file.pdf', 7200)
    })

    it('should throw when signed URL generation fails', async () => {
      const mockCreateSignedUrl = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'object not found' },
      })
      vi.mocked(supabaseModule.createClient).mockResolvedValue({
        storage: { from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) },
      } as any)

      await expect(storageService.getSignedUrl('missing/file.pdf')).rejects.toThrow(
        'Failed to generate signed URL: object not found'
      )
    })
  })

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ error: null })
      vi.mocked(supabaseModule.createClient).mockResolvedValue({
        storage: { from: vi.fn(() => ({ remove: mockRemove })) },
      } as any)

      await expect(storageService.deleteFile('user-123/file.pdf')).resolves.not.toThrow()
      expect(mockRemove).toHaveBeenCalledWith(['user-123/file.pdf'])
    })

    it('should throw when delete fails', async () => {
      const mockRemove = vi.fn().mockResolvedValue({
        error: { message: 'permission denied' },
      })
      vi.mocked(supabaseModule.createClient).mockResolvedValue({
        storage: { from: vi.fn(() => ({ remove: mockRemove })) },
      } as any)

      await expect(storageService.deleteFile('user-123/file.pdf')).rejects.toThrow(
        'Storage delete failed: permission denied'
      )
    })
  })
})

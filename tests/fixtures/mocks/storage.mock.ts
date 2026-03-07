import { vi } from 'vitest'

export const mockStorageService = {
  uploadInvoiceFile: vi.fn(async (userId: string, _file: File) => {
    return `${userId}/${Math.random().toString(36).substring(7)}`
  }),

  getSignedUrl: vi.fn(async (_path: string) => {
    return `https://example.supabase.co/storage/signed/${_path}`
  }),

  deleteFile: vi.fn(async (_path: string) => {
    // noop
  }),
}

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
    if (typeof method === 'function' && 'mockClear' in method) {
      (method as ReturnType<typeof vi.fn>).mockClear()
    }
  })
}

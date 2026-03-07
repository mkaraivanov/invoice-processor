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

    it('should throw if Supabase returns an auth error (e.g. expired token)', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'JWT expired' },
          }),
        },
      }

      vi.mocked(supabaseModule.createClient).mockResolvedValue(mockClient as any)

      await expect(authService.getUser()).rejects.toThrow('JWT expired')
    })
  })
})

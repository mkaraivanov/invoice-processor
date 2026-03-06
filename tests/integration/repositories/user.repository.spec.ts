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

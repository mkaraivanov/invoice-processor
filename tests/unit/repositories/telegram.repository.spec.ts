import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TelegramRepository } from '@/repositories/telegram.repository'

// Mock Prisma
const mockPrisma = {
  telegramChat: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}

describe('TelegramRepository', () => {
  let repository: TelegramRepository

  beforeEach(() => {
    repository = new TelegramRepository(mockPrisma as any)
    vi.clearAllMocks()
  })

  describe('upsert', () => {
    it('should create new TelegramChat if not exists', async () => {
      const chatId = '12345'
      const userId = 'user-1'
      const state = 'LINKED'

      mockPrisma.telegramChat.upsert.mockResolvedValueOnce({
        id: 'chat-1',
        telegramChatId: chatId,
        userId,
        state,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await repository.upsert(chatId, userId, state)

      expect(mockPrisma.telegramChat.upsert).toHaveBeenCalledWith({
        where: { telegramChatId: chatId },
        create: { telegramChatId: chatId, userId, state },
        update: { state, updatedAt: expect.any(Date) },
      })
      expect(result).toEqual(expect.objectContaining({ telegramChatId: chatId }))
    })

    it('should update existing TelegramChat', async () => {
      const chatId = '12345'
      const userId = 'user-1'

      mockPrisma.telegramChat.upsert.mockResolvedValueOnce({
        id: 'chat-1',
        telegramChatId: chatId,
        userId,
        state: 'IDLE',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await repository.upsert(chatId, userId, 'IDLE')

      expect(mockPrisma.telegramChat.upsert).toHaveBeenCalled()
    })
  })

  describe('findByChatId', () => {
    it('should find TelegramChat by chat ID', async () => {
      const chatId = '12345'
      const mockChat = {
        id: 'chat-1',
        telegramChatId: chatId,
        userId: 'user-1',
        state: 'LINKED',
        user: { id: 'user-1', email: 'test@example.com' },
      }

      mockPrisma.telegramChat.findUnique.mockResolvedValueOnce(mockChat)

      const result = await repository.findByChatId(chatId)

      expect(mockPrisma.telegramChat.findUnique).toHaveBeenCalledWith({
        where: { telegramChatId: chatId },
        include: { user: true },
      })
      expect(result).toEqual(mockChat)
    })

    it('should return null if chat not found', async () => {
      mockPrisma.telegramChat.findUnique.mockResolvedValueOnce(null)

      const result = await repository.findByChatId('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('findByUserId', () => {
    it('should find all TelegramChats for a user', async () => {
      const userId = 'user-1'
      const mockChats = [
        {
          id: 'chat-1',
          telegramChatId: '12345',
          userId,
          state: 'LINKED',
        },
        {
          id: 'chat-2',
          telegramChatId: '67890',
          userId,
          state: 'IDLE',
        },
      ]

      mockPrisma.telegramChat.findMany.mockResolvedValueOnce(mockChats)

      const result = await repository.findByUserId(userId)

      expect(mockPrisma.telegramChat.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })
      expect(result).toEqual(mockChats)
    })
  })

  describe('update', () => {
    it('should update TelegramChat state', async () => {
      const chatId = '12345'
      const newState = 'UNLINKED'

      mockPrisma.telegramChat.update.mockResolvedValueOnce({
        id: 'chat-1',
        telegramChatId: chatId,
        userId: 'user-1',
        state: newState,
        updatedAt: new Date(),
      })

      const result = await repository.update(chatId, { state: newState })

      expect(mockPrisma.telegramChat.update).toHaveBeenCalledWith({
        where: { telegramChatId: chatId },
        data: { state: newState, updatedAt: expect.any(Date) },
      })
      expect(result.state).toBe(newState)
    })
  })
})

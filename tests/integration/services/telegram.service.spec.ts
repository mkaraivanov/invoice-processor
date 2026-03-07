import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelegramService } from '@/services/telegram.service'
import { prisma } from '@/lib/prisma'
import { TelegramUpdate } from '@/types'

// Mock Telegram bot for integration tests
vi.mock('@/lib/telegram-bot', () => ({
  telegramBot: {
    downloadFile: vi.fn(async () => {
      // Return a simple buffer representing a small JPEG
      const buffer = new ArrayBuffer(100)
      return buffer
    }),
    sendMessage: vi.fn(async () => {}),
  },
}))

vi.mock('@/services/invoice.service', () => ({
  invoiceService: {
    uploadInvoice: vi.fn(async (userId, input, telegramChatId) => ({
      id: 'test-invoice-1',
      userId,
      fileName: input.file.name,
      fileUrl: 'invoices/user-1/test.jpg',
      status: 'PENDING',
      telegramChatId,
      createdAt: new Date(),
      uploadedAt: new Date(),
      updatedAt: new Date(),
    })),
  },
}))

describe('TelegramService Integration', () => {
  let service: TelegramService

  beforeEach(() => {
    service = new TelegramService(prisma)
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.telegramChat.deleteMany({
      where: {
        telegramChatId: { startsWith: 'test-' },
      },
    })
  })

  describe('linkTelegramChat', () => {
    it('should create a new TelegramChat', async () => {
      const chatId = `test-${Date.now()}`
      const userId = (await prisma.user.findFirst())?.id || 'test-user'

      const result = await service.linkTelegramChat(chatId, userId)

      expect(result).toMatchObject({
        telegramChatId: chatId,
        userId,
        state: 'LINKED',
      })

      // Verify in database
      const saved = await prisma.telegramChat.findUnique({
        where: { telegramChatId: chatId },
      })
      expect(saved).toBeDefined()
    })
  })

  describe('getTelegramChat', () => {
    it('should retrieve a TelegramChat by chat ID', async () => {
      const chatId = `test-${Date.now()}`
      const userId = (await prisma.user.findFirst())?.id || 'test-user'

      await service.linkTelegramChat(chatId, userId)
      const result = await service.getTelegramChat(chatId)

      expect(result).toMatchObject({
        telegramChatId: chatId,
        userId,
        state: 'LINKED',
      })
    })

    it('should return null for non-existent chat', async () => {
      const result = await service.getTelegramChat('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('updateTelegramChatState', () => {
    it('should update the state of a TelegramChat', async () => {
      const chatId = `test-${Date.now()}`
      const userId = (await prisma.user.findFirst())?.id || 'test-user'

      await service.linkTelegramChat(chatId, userId)
      const updated = await service.updateTelegramChatState(chatId, 'UNLINKED')

      expect(updated.state).toBe('UNLINKED')
    })
  })

  describe('handleInvoiceUpload', () => {
    it('should reject if chat is not linked', async () => {
      const update: TelegramUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          date: Date.now() / 1000,
          chat: {
            id: 999999,
            type: 'private',
          },
          document: {
            file_id: 'file-123',
            file_unique_id: 'unique-123',
          },
        },
      }

      await expect(service.handleInvoiceUpload(update)).rejects.toThrow()
    })

    it('should reject if no file is in message', async () => {
      const chatId = `test-${Date.now()}`
      const userId = (await prisma.user.findFirst())?.id || 'test-user'

      await service.linkTelegramChat(chatId, userId)

      const update: TelegramUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          date: Date.now() / 1000,
          chat: {
            id: Number(chatId.split('-')[1]),
            type: 'private',
          },
          text: 'Just some text',
        },
      }

      await expect(service.handleInvoiceUpload(update)).rejects.toThrow()
    })
  })
})

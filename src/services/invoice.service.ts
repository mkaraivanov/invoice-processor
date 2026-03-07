import { invoiceRepository } from '@/repositories/invoice.repository'
import { storageService } from '@/services/storage.service'
import { uploadInvoiceSchema, type UploadInvoiceInput, type ExtractedInvoiceData } from '@/types'
import type { Prisma } from '@/app/generated/prisma/client'

export const invoiceService = {
  async uploadInvoice(userId: string, input: UploadInvoiceInput, telegramChatId?: string) {
    uploadInvoiceSchema.parse(input)

    const fileUrl = await storageService.uploadInvoiceFile(userId, input.file)

    const invoice = await invoiceRepository.create({
      userId,
      fileName: input.file.name,
      fileUrl,
      ...(telegramChatId && { telegramChatId }),
    })

    return invoice
  },

  async getUserInvoices(userId: string) {
    return invoiceRepository.findByUserId(userId)
  },

  async getInvoice(invoiceId: string, userId: string) {
    const invoice = await invoiceRepository.findById(invoiceId)

    if (!invoice) throw new Error('Invoice not found')
    if (invoice.userId !== userId) throw new Error('Unauthorized')

    return invoice
  },

  async processInvoice(invoiceId: string) {
    // Atomically claim the invoice to prevent duplicate processing
    const claimed = await invoiceRepository.claimForProcessing(invoiceId)
    if (!claimed) return null // Already claimed by another worker

    try {
      // Simulate AI processing (replace with real AI call later)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const extractedData: ExtractedInvoiceData = {
        vendor: 'Acme Corp',
        amount: 1250.99,
        date: new Date().toISOString().split('T')[0],
        lineItems: [
          { description: 'Widget A', quantity: 10, unitPrice: 100, total: 1000 },
          { description: 'Service Fee', quantity: 1, unitPrice: 250.99, total: 250.99 },
        ],
      }

      await invoiceRepository.updateStatus(invoiceId, 'COMPLETED', extractedData as unknown as Prisma.InputJsonValue)

      return { invoiceId, status: 'COMPLETED', data: extractedData }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await invoiceRepository.updateStatus(invoiceId, 'FAILED', undefined, errorMessage)
      throw error
    }
  },

  async processPendingInvoices() {
    const batchSize = 3 // Conservative for Hobby plan (maxDuration=10s)
    const pendingInvoices = await invoiceRepository.findPending(batchSize)

    const startTime = Date.now()
    const maxElapsedMs = 8000 // Leave 2s buffer before Vercel kills the function
    const results = []
    for (const invoice of pendingInvoices) {
      if (Date.now() - startTime > maxElapsedMs) break // Bail before timeout
      try {
        const result = await this.processInvoice(invoice.id)
        if (result) {
          results.push(result) // null means already claimed

          // Notify Telegram user if applicable (fire-and-forget)
          if (invoice.telegramChatId) {
            this.notifyTelegramResults(invoice.id).catch((err) => {
              console.error(`Failed to notify Telegram for ${invoice.id}:`, err)
            })
          }
        }
      } catch (error) {
        console.error(`Failed to process invoice ${invoice.id}:`, error)
      }
    }

    return { processed: results.length, results }
  },

  async notifyTelegramResults(invoiceId: string) {
    const secret = process.env.TELEGRAM_NOTIFY_SECRET
    if (!secret) {
      console.warn('TELEGRAM_NOTIFY_SECRET not set, skipping notification')
      return
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const response = await fetch(`${baseUrl}/api/telegram/notify-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`,
        },
        body: JSON.stringify({ invoiceId }),
      })

      if (!response.ok) {
        throw new Error(`Notification request failed: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to call notify-results endpoint:', error)
      throw error
    }
  },
}

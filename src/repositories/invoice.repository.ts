import { prisma } from '@/lib/prisma'
import { InvoiceStatus, Prisma } from '@/app/generated/prisma/client'

export const invoiceRepository = {
  async create(data: {
    userId: string
    fileName: string
    fileUrl: string
    telegramChatId?: string
  }) {
    return prisma.invoice.create({
      data: {
        ...data,
        status: 'PENDING',
      },
    })
  },

  async findById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: { user: true },
    })
  },

  async findByUserId(userId: string, limit = 50) {
    return prisma.invoice.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
    })
  },

  async updateStatus(
    id: string,
    status: InvoiceStatus,
    extractedData?: Prisma.InputJsonValue,
    errorMessage?: string
  ) {
    return prisma.invoice.update({
      where: { id },
      data: {
        status,
        extractedData,
        errorMessage,
        processedAt: ['COMPLETED', 'FAILED'].includes(status)
          ? new Date()
          : null,
      },
    })
  },

  async findPending(limit = 5) {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000)
    return prisma.invoice.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          {
            status: 'PROCESSING',
            processingStartedAt: { lt: staleThreshold },
          },
        ],
      },
      orderBy: { uploadedAt: 'asc' },
      take: limit,
    })
  },

  async claimForProcessing(id: string) {
    const [claimed] = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE invoices SET status = 'PROCESSING', "processingStartedAt" = NOW()
       WHERE id = $1 AND status IN ('PENDING', 'PROCESSING')
       RETURNING id`,
      id
    )
    return claimed ?? null
  },

  async delete(id: string) {
    return prisma.invoice.delete({
      where: { id },
    })
  },
}

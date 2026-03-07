import { PrismaClient } from "@/app/generated/prisma/client";

export class TelegramRepository {
  constructor(private prisma: PrismaClient) {}

  async upsert(
    telegramChatId: string,
    userId: string,
    state: string = "IDLE"
  ) {
    return this.prisma.telegramChat.upsert({
      where: { telegramChatId },
      create: {
        telegramChatId,
        userId,
        state,
      },
      update: {
        state,
        updatedAt: new Date(),
      },
    });
  }

  async findByChatId(telegramChatId: string) {
    return this.prisma.telegramChat.findUnique({
      where: { telegramChatId },
      include: { user: true },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.telegramChat.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async update(
    telegramChatId: string,
    data: { state?: string }
  ) {
    return this.prisma.telegramChat.update({
      where: { telegramChatId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }
}

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "telegramChatId" TEXT;

-- CreateTable
CREATE TABLE "telegram_chats" (
    "id" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_chats_telegramChatId_key" ON "telegram_chats"("telegramChatId");

-- CreateIndex
CREATE INDEX "telegram_chats_userId_idx" ON "telegram_chats"("userId");

-- CreateIndex
CREATE INDEX "invoices_telegramChatId_idx" ON "invoices"("telegramChatId");

-- AddForeignKey
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import { TelegramRepository } from "@/repositories/telegram.repository";
import { invoiceRepository } from "@/repositories/invoice.repository";
import { invoiceService } from "@/services/invoice.service";
import { telegramBot } from "@/lib/telegram-bot";
import { PrismaClient } from "@/app/generated/prisma/client";
import { TelegramUpdate, TelegramMessage } from "@/types";

export class TelegramService {
  private telegramRepository: TelegramRepository;

  constructor(private prisma: PrismaClient) {
    this.telegramRepository = new TelegramRepository(prisma);
  }

  /**
   * Associate a Telegram chat with a platform user
   */
  async linkTelegramChat(telegramChatId: string, userId: string) {
    return this.telegramRepository.upsert(telegramChatId, userId, "LINKED");
  }

  /**
   * Get Telegram chat info by chat ID
   */
  async getTelegramChat(telegramChatId: string) {
    return this.telegramRepository.findByChatId(telegramChatId);
  }

  /**
   * Update Telegram chat state
   */
  async updateTelegramChatState(telegramChatId: string, state: string) {
    return this.telegramRepository.update(telegramChatId, { state });
  }

  /**
   * Handle incoming invoice upload from Telegram
   */
  async handleInvoiceUpload(update: TelegramUpdate) {
    if (!update.message) {
      throw new Error("No message in update");
    }

    const message = update.message;
    const telegramChatId = String(message.chat.id);

    // Verify chat is linked
    const chat = await this.getTelegramChat(telegramChatId);
    if (!chat) {
      await this.notifyUserNotLinked(telegramChatId);
      throw new Error("Chat not linked");
    }

    try {
      // Extract file from message (photo or document)
      let fileId: string | null = null;
      let fileName = "invoice";

      if (message.photo && message.photo.length > 0) {
        // Get largest photo resolution
        fileId = message.photo[message.photo.length - 1].file_id;
        fileName = "invoice.jpg";
      } else if (message.document) {
        fileId = message.document.file_id;
        fileName = message.document.file_name || "invoice.pdf";
      } else {
        await telegramBot.sendMessage(
          telegramChatId,
          "❌ Please send a photo or PDF document."
        );
        throw new Error("No photo or document in message");
      }

      // Download file from Telegram
      const buffer = await telegramBot.downloadFile(fileId);

      // Convert ArrayBuffer to File
      const file = new File(
        [new Uint8Array(buffer)],
        fileName,
        { type: this.getMimeType(fileName) }
      );

      // Upload via invoice service
      const invoice = await invoiceService.uploadInvoice(
        chat.userId,
        { file },
        telegramChatId
      );

      // Send acknowledgment
      await this.notifyAcknowledgment(telegramChatId);

      return invoice;
    } catch (error) {
      console.error("Invoice upload failed:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      await telegramBot.sendMessage(
        telegramChatId,
        `❌ Failed to process your document: ${errorMsg}`
      );
      throw error;
    }
  }

  /**
   * Send extraction results back to Telegram user
   */
  async notifyExtractionResults(invoiceId: string) {
    try {
      // Fetch invoice with extracted data
      const invoice = await invoiceRepository.findById(invoiceId);

      if (!invoice || !invoice.telegramChatId) {
        console.log(
          `Invoice ${invoiceId} has no Telegram chat ID, skipping notification`
        );
        return;
      }

      if (invoice.status === "FAILED") {
        const errorMsg = invoice.errorMessage || "Unknown error";
        await telegramBot.sendMessage(
          Number(invoice.telegramChatId),
          `❌ <b>Processing Failed</b>\n\n${errorMsg}`
        );
        return;
      }

      if (invoice.status !== "COMPLETED" || !invoice.extractedData) {
        console.log(`Invoice ${invoiceId} not ready for notification`);
        return;
      }

      // Format extraction results
      const data = invoice.extractedData as {
        vendor?: string;
        amount?: number;
        date?: string;
        lineItems?: Array<{
          description: string;
          quantity: number;
          unitPrice: number;
          total: number;
        }>;
      };

      let message = "<b>✅ Extraction Complete</b>\n\n";

      if (data.vendor) {
        message += `<b>Vendor:</b> ${data.vendor}\n`;
      }
      if (data.amount) {
        message += `<b>Amount:</b> $${data.amount.toFixed(2)}\n`;
      }
      if (data.date) {
        message += `<b>Date:</b> ${data.date}\n`;
      }

      if (data.lineItems && data.lineItems.length > 0) {
        message += `\n<b>Line Items:</b>\n`;
        data.lineItems.forEach((item) => {
          message += `• ${item.description}: ${item.quantity}x $${item.unitPrice.toFixed(2)} = $${item.total.toFixed(2)}\n`;
        });
      }

      await telegramBot.sendMessage(
        Number(invoice.telegramChatId),
        message
      );
    } catch (error) {
      console.error(
        `Failed to notify extraction results for ${invoiceId}:`,
        error
      );
      // Don't throw - log only, let cron continue
    }
  }

  /**
   * Notify user that their Telegram chat isn't linked to an account
   */
  async notifyUserNotLinked(telegramChatId: string) {
    const message =
      "🔗 Your Telegram account isn't linked to the platform yet.\n" +
      "Please register at [platform URL] first, then link your Telegram.";

    try {
      await telegramBot.sendMessage(telegramChatId, message);
    } catch (error) {
      console.error(
        `Failed to send linking notification to ${telegramChatId}:`,
        error
      );
    }
  }

  /**
   * Send acknowledgment that file was received
   */
  async notifyAcknowledgment(telegramChatId: string) {
    const message = "✅ Document received! Processing...";

    try {
      await telegramBot.sendMessage(telegramChatId, message);
    } catch (error) {
      console.error(
        `Failed to send acknowledgment to ${telegramChatId}:`,
        error
      );
    }
  }

  /**
   * Helper: determine MIME type from filename
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "application/pdf";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "png":
        return "image/png";
      default:
        return "application/octet-stream";
    }
  }
}

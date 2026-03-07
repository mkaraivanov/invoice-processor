import { NextRequest, NextResponse } from "next/server";
import { telegramUpdateSchema } from "@/types";
import { TelegramService } from "@/services/telegram.service";
import { prisma } from "@/lib/prisma";

/**
 * Handle incoming Telegram updates (webhook endpoint)
 * In production, this would be called by Telegram when messages arrive.
 * In development, Telegraf polls this endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate Telegram update structure
    const update = telegramUpdateSchema.parse(body);

    if (!update.message) {
      return NextResponse.json(
        { error: "No message in update" },
        { status: 400 }
      );
    }

    const message = update.message;

    // Extract Telegram chat ID
    const telegramChatId = String(message.chat.id);

    // Verify that a TelegramChat exists for this chat ID
    // (user must be registered first)
    const telegramService = new TelegramService(prisma);
    const chat = await telegramService.getTelegramChat(telegramChatId);

    if (!chat) {
      // User hasn't linked their Telegram chat yet
      await telegramService.notifyUserNotLinked(telegramChatId);
      return NextResponse.json(
        { error: "User not linked" },
        { status: 403 }
      );
    }

    // Handle invoice upload
    try {
      await telegramService.handleInvoiceUpload(update);
    } catch (error) {
      // Error already handled and user notified in service
      console.error("Invoice upload handler error:", error);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

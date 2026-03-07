import { NextRequest, NextResponse } from "next/server";
import { TelegramService } from "@/services/telegram.service";
import { prisma } from "@/lib/prisma";

/**
 * Internal endpoint to notify Telegram users of extraction results
 * Called by the cron job after processing invoices
 *
 * Expected body: { invoiceId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal secret
    const authHeader = request.headers.get("authorization");
    const secret = process.env.TELEGRAM_NOTIFY_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { invoiceId } = body;

    if (!invoiceId || typeof invoiceId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid invoiceId" },
        { status: 400 }
      );
    }

    // Send notification
    const telegramService = new TelegramService(prisma);
    await telegramService.notifyExtractionResults(invoiceId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Notify results error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

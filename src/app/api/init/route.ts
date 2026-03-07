// This route initializes the Telegram bot on startup
import { telegramBot } from "@/lib/telegram-bot";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", bot: Boolean(telegramBot) });
}

import { Telegraf } from "telegraf";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

// Singleton Telegraf instance
const bot = new Telegraf(TOKEN);

// Enable polling (no webhook required)
if (process.env.NODE_ENV === "development") {
  bot.launch();
  console.log("Telegram bot polling started");
}

export const telegramBot = {
  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(chatId: number | string, text: string) {
    try {
      await bot.telegram.sendMessage(chatId, text, {
        parse_mode: "HTML",
      });
    } catch (error) {
      console.error(
        `Failed to send Telegram message to ${chatId}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Get file info from Telegram
   */
  async getFile(fileId: string) {
    try {
      return await bot.telegram.getFile(fileId);
    } catch (error) {
      console.error(`Failed to get Telegram file ${fileId}:`, error);
      throw error;
    }
  },

  /**
   * Download a file from Telegram CDN
   */
  async downloadFile(fileId: string) {
    try {
      const file = await bot.telegram.getFile(fileId);
      if (!file.file_path) {
        throw new Error("File path not available");
      }

      const url = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      return response.arrayBuffer();
    } catch (error) {
      console.error(`Failed to download Telegram file ${fileId}:`, error);
      throw error;
    }
  },

  /**
   * Get Telegram bot instance for advanced operations
   */
  getInstance() {
    return bot;
  },
};

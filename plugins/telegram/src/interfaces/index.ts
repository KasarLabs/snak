import TelegramBot from 'node-telegram-bot-api';

/**
 * Telegram Interface.
 *
 * @param {string} bot_token - Telegram bot authentication token
 * @param {string} public_url - Public URL for the webhook
 * @param {string} bot_port - Port number for the server to listen on
 * @param {TelegramBot} bot - Telegram bot instance
 */

export interface TelegramInterface {
  bot_token?: string;
  public_url?: string;
  bot_port?: number;
  bot?: TelegramBot;
}

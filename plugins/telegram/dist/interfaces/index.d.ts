import TelegramBot from 'node-telegram-bot-api';
export interface TelegramInterface {
    bot_token?: string;
    public_url?: string;
    bot_port?: number;
    bot?: TelegramBot;
}

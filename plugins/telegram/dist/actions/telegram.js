"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegram_get_messages_from_conversation = void 0;
const express_1 = __importDefault(require("express"));
const types_1 = require("../types");
class TelegramBotServer {
    constructor(token, port, url, bot, max_message, channel_id) {
        this.pendingMessages = [];
        this.resolveMessages = null;
        this.token = token;
        this.port = port;
        this.url = url;
        this.app = (0, express_1.default)();
        this.bot = bot;
        this.max_message = max_message;
        this.channel_id = channel_id;
    }
    async waitForPendingMessages() {
        const webhookInfo = await this.bot.getWebHookInfo();
        let pendingCount = webhookInfo.pending_update_count;
        if (pendingCount === 0) {
            return [];
        }
        return new Promise((resolve) => {
            this.resolveMessages = resolve;
            setTimeout(() => {
                if (this.resolveMessages) {
                    this.resolveMessages(this.pendingMessages);
                    this.resolveMessages = null;
                }
            }, types_1.TelegramServerConstant.WEBHOOK_TIMEOUT_MS);
        });
    }
    setupServer() {
        this.app.use(express_1.default.json());
        this.app.post(`/bot${this.token}`, (req, res) => {
            try {
                this.bot.processUpdate(req.body);
                res.sendStatus(types_1.TelegramServerConstant.HTTP_STATUS_OK);
            }
            catch (error) {
                console.error('Error during the update processing:', error);
                res.sendStatus(types_1.TelegramServerConstant.HTTP_STATUS_ERROR);
            }
        });
        this.server = this.app.listen(this.port, () => { });
    }
    async setupWebhook() {
        try {
            await this.bot.deleteWebHook();
            await this.bot.setWebHook(`${this.url}/bot${this.token}`);
            const webhookInfo = await this.bot.getWebHookInfo();
        }
        catch (error) {
            console.log('Error while configuring Telegram webhook:', error);
        }
    }
    setupBotHandlers() {
        this.bot.on('message', async (msg) => {
            try {
                if (msg.chat.id === this.channel_id && this.max_message > 0) {
                    this.pendingMessages.push(msg);
                    this.max_message = this.max_message - 1;
                }
                const webhookInfo = await this.bot.getWebHookInfo();
                if (this.resolveMessages &&
                    (webhookInfo.pending_update_count === 0 || this.max_message === 0)) {
                    this.resolveMessages(this.pendingMessages);
                    this.resolveMessages = null;
                }
            }
            catch (error) {
                console.log('Error processing message:', error);
            }
        });
        this.bot.on('error', (error) => {
            console.error('Bot error:', error);
        });
        this.bot.on('webhook_error', (error) => {
            console.error('Webhook error:', error);
        });
    }
    setupErrorHandlers() {
        process.on('unhandledRejection', (error) => {
            console.error('Unhandled rejection:', error);
        });
        process.on('uncaughtException', (error) => {
            console.error('Uncaught exception:', error);
        });
    }
    async cleanup() {
        try {
            await this.bot.deleteWebHook();
            this.bot.removeAllListeners();
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(() => {
                        console.log('Express server stopped');
                        resolve();
                    });
                });
            }
        }
        catch (error) {
            console.log('Error during cleanup:', error);
        }
    }
    async start() {
        try {
            this.setupServer();
            this.setupBotHandlers();
            this.setupErrorHandlers();
            await this.setupWebhook();
            const string = [];
            const messages = await this.waitForPendingMessages();
            messages.forEach((message) => {
                string.push(message.text);
            });
            return string;
        }
        catch (error) {
            console.log('Error during bot startup:', error);
            return [];
        }
    }
}
const telegram_get_messages_from_conversation = async (agent, params) => {
    try {
        const bot_config = agent.getTelegramManager();
        if (!bot_config.bot_token ||
            !bot_config.bot_port ||
            !bot_config.public_url ||
            !bot_config.bot) {
            throw new Error(`Telegram manager is not set`);
        }
        const bot = new TelegramBotServer(bot_config.bot_token, bot_config.bot_port, bot_config.public_url, bot_config.bot, params.max_message, params.channel_id);
        const messages = await bot.start();
        await bot.cleanup();
        return {
            status: 'success',
            messages: messages,
        };
    }
    catch (error) {
        console.log('Error:', error);
        return {
            status: 'error',
            error: error,
        };
    }
};
exports.telegram_get_messages_from_conversation = telegram_get_messages_from_conversation;
//# sourceMappingURL=telegram.js.map
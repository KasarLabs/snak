import TelegramBot from 'node-telegram-bot-api';
import express, { Express, Request, Response, Application } from 'express';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { getTelegramMessageUpdateFromConversationParams } from '../schema';
import { TelegramServerConstant } from '../types';

/**
 * Manage a Telegram Bot server.
 * this class provides :
 * - Telegram webhook configuration
 * - Handling message history
 */

class TelegramBotServer {
  private token: string;
  private app: Application;
  private bot: TelegramBot;
  private port: number;
  private url: string;
  private max_message: number;
  private channel_id: number;
  private pendingMessages: TelegramBot.Message[] = [];
  private resolveMessages: ((messages: TelegramBot.Message[]) => void) | null =
    null;
  private server: any;

  /**
   * Creates a new instance of the Telegram Bot Server.
   *
   * @param {string} token - Telegram bot authentication token
   * @param {number} port - Port number for the server to listen on
   * @param {string} url - Public URL for the webhook
   * @param {TelegramBot} bot - Telegram bot instance
   * @param {number} max_message - Maximum number of messages to collect
   * @param {number} channel_id - Telegram channel ID to monitor
   * @throws {Error} If required parameters are missing
   */

  constructor(
    token: string,
    port: number,
    url: string,
    bot: TelegramBot,
    max_message: number,
    channel_id: number
  ) {
    this.token = token;
    this.port = port;
    this.url = url;
    this.app = express();
    this.bot = bot;
    this.max_message = max_message;
    this.channel_id = channel_id;
  }

  /**
   * Waits for pending webhook messages.
   * Terminates after timeout or when all messages are received.
   *
   * @private
   * @returns {Promise<TelegramBot.Message[]>} List of received messages
   */
  private async waitForPendingMessages(): Promise<TelegramBot.Message[]> {
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
      }, TelegramServerConstant.WEBHOOK_TIMEOUT_MS);
    });
  }

  /**
   * Sets up Express server and webhook routes.
   *
   * @private
   * @throws {Error} If server setup fails
   */
  private setupServer(): void {
    this.app.use(express.json());

    this.app.post(`/bot${this.token}`, (req: Request, res: Response) => {
      try {
        this.bot.processUpdate(req.body);
        res.sendStatus(TelegramServerConstant.HTTP_STATUS_OK);
      } catch (error) {
        console.error('Error during the update processing:', error);
        res.sendStatus(TelegramServerConstant.HTTP_STATUS_ERROR);
      }
    });

    this.server = this.app.listen(this.port, () => {});
  }

  /**
   * Sets up Webhook and delete old webhook.
   *
   * @private
   * @throws {Error} If webhook setup fails
   */
  private async setupWebhook(): Promise<void> {
    try {
      await this.bot.deleteWebHook();

      await this.bot.setWebHook(`${this.url}/bot${this.token}`);
      const webhookInfo = await this.bot.getWebHookInfo();
    } catch (error) {
      console.log('Error while configuring Telegram webhook:', error);
    }
  }

  private setupBotHandlers(): void {
    this.bot.on('message', async (msg: TelegramBot.Message) => {
      try {
        if (msg.chat.id === this.channel_id && this.max_message > 0) {
          this.pendingMessages.push(msg);
          this.max_message = this.max_message - 1;
        }
        const webhookInfo = await this.bot.getWebHookInfo();
        if (
          this.resolveMessages &&
          (webhookInfo.pending_update_count === 0 || this.max_message === 0)
        ) {
          this.resolveMessages(this.pendingMessages);
          this.resolveMessages = null;
        }
      } catch (error) {
        console.log('Error processing message:', error);
      }
    });

    this.bot.on('error', (error: Error) => {
      console.error('Bot error:', error);
    });

    this.bot.on('webhook_error', (error: Error) => {
      console.error('Webhook error:', error);
    });
  }

  private setupErrorHandlers(): void {
    process.on('unhandledRejection', (error: Error) => {
      console.error('Unhandled rejection:', error);
    });

    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught exception:', error);
    });
  }

  /**
   * Cleans up server and bot resources.
   * Should be called before program termination.
   *
   * @public
   * @returns {Promise<void>}
   */
  public async cleanup(): Promise<void> {
    try {
      await this.bot.deleteWebHook();

      this.bot.removeAllListeners();

      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server.close(() => {
            console.log('Express server stopped');
            resolve();
          });
        });
      }
    } catch (error) {
      console.log('Error during cleanup:', error);
    }
  }

  /**
   * Starts the server and begins collecting messages.
   *
   * @public
   * @returns {Promise<string[]>} List of collected message texts
   * @throws {Error} If startup fails
   */
  public async start(): Promise<string[]> {
    try {
      this.setupServer();
      this.setupBotHandlers();
      this.setupErrorHandlers();
      await this.setupWebhook();
      const string: string[] = [];

      const messages = await this.waitForPendingMessages();
      messages.forEach((message) => {
        string.push(message.text as string);
      });
      return string;
    } catch (error) {
      console.log('Error during bot startup:', error);
      return [];
    }
  }
}

/**
 * Retrieves messages from a Telegram conversation.
 *
 * @param {StarknetAgentInterface} agent - Starknet agent with Telegram configuration
 * @param {getTelegramMessageUpdateFromConversationParmas} params - Request parameters
 * @returns {Promise<{status: string, messages?: string[], error?: any}>} Operation result
 */
export const telegram_get_messages_from_conversation = async (
  agent: StarknetAgentInterface,
  params: getTelegramMessageUpdateFromConversationParams
) => {
  try {
    const bot_config = agent.getTelegramManager();
    if (
      !bot_config.bot_token ||
      !bot_config.bot_port ||
      !bot_config.public_url ||
      !bot_config.bot
    ) {
      throw new Error(`Telegram manager is not set`);
    }
    const bot = new TelegramBotServer(
      bot_config.bot_token,
      bot_config.bot_port,
      bot_config.public_url,
      bot_config.bot,
      params.max_message,
      params.channel_id
    );
    const messages = await bot.start();
    await bot.cleanup();
    return {
      status: 'success',
      messages: messages,
    };
  } catch (error) {
    console.log('Error:', error);
    return {
      status: 'error',
      error: error,
    };
  }
};

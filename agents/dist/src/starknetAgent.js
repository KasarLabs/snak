"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetAgent = void 0;
const agent_1 = require("./agent");
const common_1 = require("../common");
const common_2 = require("../common");
const autonomousAgents_1 = require("./autonomousAgents");
const agent_twitter_client_1 = require("agent-twitter-client");
const twitter_api_v2_1 = require("twitter-api-v2");
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
class StarknetAgent {
    constructor(config) {
        this.config = config;
        this.twitterAccoutManager = {};
        this.telegramAccountManager = {};
        this.validateConfig(config);
        this.provider = config.provider;
        this.accountPrivateKey = config.accountPrivateKey;
        this.accountPublicKey = config.accountPublicKey;
        this.aiModel = config.aiModel;
        this.aiProviderApiKey = config.aiProviderApiKey;
        this.signature = config.signature;
        this.agentMode = config.agentMode;
        this.currentMode = config.agentMode;
        this.agentconfig = config.agentconfig;
        this.transactionMonitor = new common_1.TransactionMonitor(this.provider);
        this.contractInteractor = new common_2.ContractInteractor(this.provider);
    }
    async createAgentReactExecutor() {
        const config = {
            aiModel: this.aiModel,
            aiProviderApiKey: this.aiProviderApiKey,
            aiProvider: this.config.aiProvider,
        };
        if (this.currentMode === 'auto') {
            this.agentReactExecutor = await (0, autonomousAgents_1.createAutonomousAgent)(this, config);
        }
        else if (this.currentMode === 'agent') {
            this.agentReactExecutor = await (0, agent_1.createAgent)(this, config);
        }
    }
    validateConfig(config) {
        if (!config.accountPrivateKey) {
            throw new Error('Starknet wallet private key is required https://www.argent.xyz/argent-x');
        }
        if (config.aiModel !== 'ollama' && !config.aiProviderApiKey) {
            throw new Error('AI Provider API key is required');
        }
    }
    async switchMode(newMode) {
        if (newMode === 'auto' && !this.agentconfig?.autonomous) {
            return 'Cannot switch to autonomous mode - not enabled in configuration';
        }
        if (this.currentMode === newMode) {
            return `Already in ${newMode} mode`;
        }
        this.currentMode = newMode;
        this.createAgentReactExecutor();
        return `Switched to ${newMode} mode`;
    }
    async initializeTelegramManager() {
        try {
            const bot_token = process.env.TELEGRAM_BOT_TOKEN;
            if (!bot_token) {
                throw new Error(`TELEGRAM_BOT_TOKEN is not set in your .env`);
            }
            const public_url = process.env.TELEGRAM_PUBLIC_URL;
            if (!public_url) {
                throw new Error(`TELEGRAM_PUBLIC_URL is not set in your .env`);
            }
            const bot_port = parseInt(process.env.TELEGRAM_BOT_PORT, 10);
            if (isNaN(bot_port)) {
                throw new Error('TELEGRAM_BOT_PORT must be a valid number');
            }
            const bot = new node_telegram_bot_api_1.default(bot_token, {
                webHook: { port: bot_port },
            });
            if (!bot) {
                throw new Error(`Error trying to set your bot`);
            }
            const TelegramInterfaces = {
                bot_token: bot_token,
                public_url: public_url,
                bot_port: bot_port,
                bot: bot,
            };
            this.telegramAccountManager = TelegramInterfaces;
        }
        catch (error) {
            console.log(error);
            return;
        }
    }
    async initializeTwitterManager() {
        const auth_mode = process.env.TWITTER_AUTH_MODE;
        try {
            if (auth_mode === 'CREDENTIALS') {
                const username = process.env.TWITTER_USERNAME;
                const password = process.env.TWITTER_PASSWORD;
                const email = process.env.TWITTER_EMAIL;
                if (!username || !password) {
                    throw new Error('Error when try to initializeTwitterManager in CREDENTIALS twitter_auth_mode check your .env');
                }
                const user_client = new agent_twitter_client_1.Scraper();
                await user_client.login(username, password, email);
                const account = await user_client.me();
                if (!account) {
                    throw new Error('Impossible to get your twitter account information');
                }
                const userClient = {
                    twitter_client: user_client,
                    twitter_id: account?.userId,
                    twitter_username: account?.username,
                };
                this.twitterAccoutManager.twitter_scraper = userClient;
            }
            else if (auth_mode === 'API') {
                const twitter_api = process.env.TWITTER_API;
                const twitter_api_secret = process.env.TWITTER_API_SECRET;
                const twitter_access_token = process.env.TWITTER_ACCESS_TOKEN;
                const twitter_access_token_secret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
                if (!twitter_api ||
                    !twitter_api_secret ||
                    !twitter_access_token ||
                    !twitter_access_token_secret) {
                    throw new Error('Error when try to initializeTwitterManager in API twitter_auth_mode check your .env');
                }
                const userClient = new twitter_api_v2_1.TwitterApi({
                    appKey: twitter_api,
                    appSecret: twitter_api_secret,
                    accessToken: twitter_access_token,
                    accessSecret: twitter_access_token_secret,
                });
                if (!userClient) {
                    throw new Error('Error when trying to createn you Twitter API Account check your API Twitter CREDENTIALS');
                }
                const apiConfig = {
                    twitter_api: twitter_api,
                    twitter_api_secret: twitter_api_secret,
                    twitter_access_token: twitter_access_token,
                    twitter_access_token_secret: twitter_access_token_secret,
                    twitter_api_client: userClient,
                };
                this.twitterAccoutManager.twitter_api = apiConfig;
            }
            else {
                return;
            }
        }
        catch (error) {
            console.log(error);
            return;
        }
    }
    getAccountCredentials() {
        return {
            accountPrivateKey: this.accountPrivateKey,
            accountPublicKey: this.accountPublicKey,
        };
    }
    getModelCredentials() {
        return {
            aiModel: this.aiModel,
            aiProviderApiKey: this.aiProviderApiKey,
        };
    }
    getSignature() {
        return {
            signature: this.signature,
        };
    }
    getAgent() {
        return {
            agentMode: this.currentMode,
        };
    }
    getAgentConfig() {
        return this.agentconfig;
    }
    getProvider() {
        return this.provider;
    }
    getTwitterAuthMode() {
        return process.env.TWITTER_AUTH_MODE;
    }
    getTwitterManager() {
        if (!this.twitterAccoutManager) {
            throw new Error('Twitter manager not initialized. Call initializeTwitterManager() first');
        }
        return this.twitterAccoutManager;
    }
    getTelegramManager() {
        if (!this.telegramAccountManager) {
            throw new Error('Telegram manager not initialized. Call initializeTwitterManager() first');
        }
        return this.telegramAccountManager;
    }
    async validateRequest(request) {
        return Boolean(request && typeof request === 'string');
    }
    async execute(input) {
        if (input.toLowerCase().includes('switch to autonomous')) {
            return this.switchMode('auto');
        }
        else if (input.toLowerCase().includes('switch to interactive')) {
            return this.switchMode('agent');
        }
        if (this.currentMode !== 'agent') {
            throw new Error(`Can't use execute with agent_mode: ${this.currentMode}`);
        }
        const result = await this.agentReactExecutor.invoke({
            messages: input,
        });
        return result.messages[result.messages.length - 1].content;
    }
    async execute_autonomous() {
        if (this.currentMode !== 'auto') {
            throw new Error(`Can't use execute_autonomous with agent_mode: ${this.currentMode}`);
        }
        while (true) {
            const result = await this.agentReactExecutor.agent.invoke({
                messages: 'Choose what to do',
            }, this.agentReactExecutor.agentConfig);
            console.log(result.messages[result.messages.length - 1].content);
            await new Promise((resolve) => setTimeout(resolve, this.agentReactExecutor.json_config.interval));
        }
    }
    async execute_call_data(input) {
        if (this.currentMode !== 'agent') {
            throw new Error(`Can't use execute call data with agent_mode: ${this.currentMode}`);
        }
        const aiMessage = await this.agentReactExecutor.invoke({ messages: input });
        try {
            const parsedResult = JSON.parse(aiMessage.messages[aiMessage.messages.length - 2].content);
            return parsedResult;
        }
        catch (parseError) {
            return {
                status: 'failure',
                error: `Failed to parse observation: ${parseError.message}`,
            };
        }
    }
}
exports.StarknetAgent = StarknetAgent;
//# sourceMappingURL=starknetAgent.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WalletService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const configuration_1 = require("../../config/configuration");
const errors_1 = require("../../common/errors");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
let WalletService = WalletService_1 = class WalletService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(WalletService_1.name);
    }
    async handleUserCalldataRequest(agent, userRequest) {
        try {
            const status = await this.getAgentStatus(agent);
            if (!status.isReady) {
                throw new errors_1.AgentCredentialsError('Agent is not properly configured');
            }
            if (!(await agent.validateRequest(userRequest.request))) {
                throw new errors_1.AgentValidationError('Invalid request format or parameters');
            }
            const result = await agent.execute_call_data(userRequest.request);
            return result;
        }
        catch (error) {
            return error;
        }
    }
    async HandleOutputIAParsing(userRequest) {
        try {
            const request = `Your are an AI Assistant that have for objectives :
       You will receive JSON format, I want you to extract all data you can and write a response clear.
       For the format response : 
       -  Very important You only send me back the response without any explication
       -  If its a success add ✅ if its a failure add ❌ at the start
       -  If you got a transaction_hash, display it in last and do https://starkscan.co/tx/{transaction_hash} 

       example you receive "{\\"status\\":\\"success\\",\\"transaction_type\\":\\"READ\\",\\"balance\\":\\"0.001217909843430357\\"}"\n' you return 'Your Read Transaction is succesful you balance is 0.00121.
       This is your the data you need to parse :${userRequest.request}`;
            const anthropic = new sdk_1.default({
                apiKey: process.env.AI_PROVIDER_API_KEY,
            });
            const msg = await anthropic.messages.create({
                model: process.env.AI_MODEL,
                max_tokens: 1024,
                messages: [{ role: 'user', content: request }],
            });
            if ('text' in msg.content[0]) {
                console.log(msg.content[0].text);
                return msg.content[0].text;
            }
            return '';
        }
        catch (error) {
            return error;
        }
    }
    async getAgentStatus(agent) {
        try {
            const credentials = agent.getAccountCredentials();
            const model = agent.getModelCredentials();
            return {
                isReady: Boolean(credentials && model.aiProviderApiKey),
                walletConnected: Boolean(credentials.accountPrivateKey),
                apiKeyValid: Boolean(model.aiProviderApiKey),
            };
        }
        catch (error) {
            this.logger.error('Error checking agent status', error);
            return {
                isReady: false,
                walletConnected: false,
                apiKeyValid: false,
            };
        }
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = WalletService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [configuration_1.ConfigurationService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map
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
var AgentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const common_1 = require("@nestjs/common");
const configuration_1 = require("../../config/configuration");
const errors_1 = require("../../common/errors");
let AgentService = AgentService_1 = class AgentService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(AgentService_1.name);
    }
    async handleUserRequest(agent, userRequest) {
        this.logger.debug({
            message: 'Processing agent request',
            request: userRequest.request,
        });
        try {
            const status = await this.getAgentStatus(agent);
            if (!status.isReady) {
                throw new errors_1.AgentCredentialsError('Agent is not properly configured');
            }
            if (!(await agent.validateRequest(userRequest.request))) {
                throw new errors_1.AgentValidationError('Invalid request format or parameters');
            }
            const result = await agent.execute(userRequest.request);
            this.logger.debug({
                message: 'Agent request processed successfully',
                result,
            });
            return {
                status: 'success',
                data: result,
            };
        }
        catch (error) {
            this.logger.error('Error processing agent request', {
                error: {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                },
                request: userRequest.request,
            });
            if (error instanceof errors_1.AgentValidationError) {
                throw error;
            }
            if (error.message?.includes('transaction')) {
                throw new errors_1.StarknetTransactionError('Failed to execute transaction', {
                    originalError: error.message,
                    cause: error,
                });
            }
            throw new errors_1.AgentExecutionError('Failed to process agent request', {
                originalError: error.message,
                cause: error,
            });
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
exports.AgentService = AgentService;
exports.AgentService = AgentService = AgentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [configuration_1.ConfigurationService])
], AgentService);
//# sourceMappingURL=agent.service.js.map
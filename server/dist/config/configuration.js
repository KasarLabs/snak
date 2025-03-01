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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const starknet_1 = require("starknet");
const env_validation_1 = require("./env.validation");
let ConfigurationService = class ConfigurationService {
    constructor(configService) {
        this.configService = configService;
        const envVariables = {
            NODE_ENV: this.configService.get('NODE_ENV'),
            SERVER_PORT: this.configService.get('SERVER_PORT'),
            SERVER_API_KEY: this.configService.get('SERVER_API_KEY'),
            STARKNET_PRIVATE_KEY: this.configService.get('STARKNET_PRIVATE_KEY'),
            STARKNET_PUBLIC_ADDRESS: this.configService.get('STARKNET_PUBLIC_ADDRESS'),
            STARKNET_RPC_URL: this.configService.get('STARKNET_RPC_URL'),
            AI_PROVIDER: this.configService.get('AI_PROVIDER'),
            AI_MODEL: this.configService.get('AI_MODEL'),
            AI_PROVIDER_API_KEY: this.configService.get('AI_PROVIDER_API_KEY'),
        };
        const result = env_validation_1.envSchema.safeParse(envVariables);
        if (!result.success) {
            console.error('❌ Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
            throw new Error('Invalid environment variables');
        }
        this.config = result.data;
    }
    get port() {
        return this.config.SERVER_PORT;
    }
    get nodeEnv() {
        return this.config.NODE_ENV;
    }
    get apiKey() {
        return this.config.SERVER_API_KEY;
    }
    get starknet() {
        return {
            privateKey: this.config.STARKNET_PRIVATE_KEY,
            publicKey: this.config.STARKNET_PUBLIC_ADDRESS,
            provider: new starknet_1.RpcProvider({ nodeUrl: this.config.STARKNET_RPC_URL }),
        };
    }
    get ai() {
        return {
            provider: this.config.AI_PROVIDER,
            model: this.config.AI_MODEL,
            apiKey: this.config.AI_PROVIDER_API_KEY,
        };
    }
    get isDevelopment() {
        return this.config.NODE_ENV === 'development';
    }
    get isProduction() {
        return this.config.NODE_ENV === 'production';
    }
    get isTest() {
        return this.config.NODE_ENV === 'test';
    }
};
exports.ConfigurationService = ConfigurationService;
exports.ConfigurationService = ConfigurationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ConfigurationService);
//# sourceMappingURL=configuration.js.map
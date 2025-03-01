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
exports.AgentFactory = void 0;
const common_1 = require("@nestjs/common");
const configuration_1 = require("../config/configuration");
const agents_1 = require("@starknet-agent-kit/agents");
let AgentFactory = class AgentFactory {
    constructor(config) {
        this.config = config;
        this.agentInstances = new Map();
        const json_config = (0, agents_1.load_json_config)('default.agent.json');
        if (!json_config) {
            throw new Error('Failed to load agent configuration');
        }
        this.json_config = json_config;
    }
    createAgent(signature, agentMode = 'agent') {
        if (this.agentInstances.has(signature)) {
            const agentSignature = this.agentInstances.get(signature);
            if (!agentSignature)
                throw new Error(`Agent with signature ${signature} exists in map but returned undefined`);
            return agentSignature;
        }
        const agent = new agents_1.StarknetAgent({
            provider: this.config.starknet.provider,
            accountPrivateKey: this.config.starknet.privateKey,
            accountPublicKey: this.config.starknet.publicKey,
            aiModel: this.config.ai.model,
            aiProvider: this.config.ai.provider,
            aiProviderApiKey: this.config.ai.apiKey,
            agentconfig: this.json_config,
            signature: signature,
            agentMode: agentMode,
        });
        this.agentInstances.set(signature, agent);
        return agent;
    }
};
exports.AgentFactory = AgentFactory;
exports.AgentFactory = AgentFactory = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [configuration_1.ConfigurationService])
], AgentFactory);
//# sourceMappingURL=agents.factory.js.map
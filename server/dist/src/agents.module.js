"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentsModule = void 0;
const common_1 = require("@nestjs/common");
const agent_service_1 = require("./services/agent.service");
const agents_controller_1 = require("./agents.controller");
const config_module_1 = require("../config/config.module");
const wallet_controller_1 = require("./wallet.controller");
const wallet_service_1 = require("./services/wallet.service");
const throttler_1 = require("@nestjs/throttler");
const core_1 = require("@nestjs/core");
const agents_factory_1 = require("./agents.factory");
let AgentsModule = class AgentsModule {
};
exports.AgentsModule = AgentsModule;
exports.AgentsModule = AgentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.ConfigModule,
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 5,
                },
            ]),
        ],
        providers: [
            agent_service_1.AgentService,
            wallet_service_1.WalletService,
            agents_factory_1.AgentFactory,
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
        controllers: [agents_controller_1.AgentsController, wallet_controller_1.WalletController],
        exports: [agent_service_1.AgentService, wallet_service_1.WalletService, agents_factory_1.AgentFactory],
    })
], AgentsModule);
//# sourceMappingURL=agents.module.js.map
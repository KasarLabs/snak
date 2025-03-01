"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const agents_module_1 = require("./src/agents.module");
const core_1 = require("@nestjs/core");
const response_1 = require("./src/interceptors/response");
const ApikeyGuard_1 = require("./src/guard/ApikeyGuard");
const config_module_1 = require("./config/config.module");
const cleanup_module_1 = require("./common/cleanup/cleanup.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [config_module_1.ConfigModule, agents_module_1.AgentsModule, cleanup_module_1.CleanupModule],
        providers: [
            {
                provide: core_1.APP_GUARD,
                useClass: ApikeyGuard_1.ApiKeyGuard,
            },
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: response_1.AgentResponseInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
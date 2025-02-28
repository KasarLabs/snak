"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentResponseInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let AgentResponseInterceptor = class AgentResponseInterceptor {
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        const url = request.url;
        if (url === '/api/wallet/request') {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.map)((data) => {
            const request = context.switchToHttp().getRequest().body?.request || '';
            let responseText;
            if (data?.data?.output) {
                return data.data;
            }
            try {
                if (typeof data === 'string') {
                    const lastBraceIndex = data.lastIndexOf('}');
                    if (lastBraceIndex !== -1) {
                        responseText = data.substring(lastBraceIndex + 1).trim();
                    }
                    else {
                        responseText = data;
                    }
                }
                else if (data?.data) {
                    responseText =
                        typeof data.data === 'string'
                            ? data.data
                            : JSON.stringify(data.data);
                }
                else {
                    responseText = JSON.stringify(data);
                }
                responseText = responseText.trim();
                return {
                    input: request,
                    output: [
                        {
                            index: 0,
                            type: 'text',
                            text: responseText,
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    input: request,
                    output: [
                        {
                            index: 0,
                            type: 'text',
                            text: typeof data === 'string' ? data : JSON.stringify(data),
                        },
                    ],
                };
            }
        }));
    }
};
exports.AgentResponseInterceptor = AgentResponseInterceptor;
exports.AgentResponseInterceptor = AgentResponseInterceptor = __decorate([
    (0, common_1.Injectable)()
], AgentResponseInterceptor);
//# sourceMappingURL=response.js.map
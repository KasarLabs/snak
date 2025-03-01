"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var allLeftOverExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.allLeftOverExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const constant_1 = require("../interceptors/constant");
let allLeftOverExceptionFilter = allLeftOverExceptionFilter_1 = class allLeftOverExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(allLeftOverExceptionFilter_1.name);
    }
    catch(exception, host) {
        this.logger.log('Excepetion catched in allLeftOverException');
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        this.logger.log({ exception });
        const message = exception instanceof Error ? exception?.message : constant_1.INTERNAL_SERVER_ERROR;
        console.log({ message });
        response.status(status).send({
            status,
            message: message,
            path: request.url,
        });
    }
};
exports.allLeftOverExceptionFilter = allLeftOverExceptionFilter;
exports.allLeftOverExceptionFilter = allLeftOverExceptionFilter = allLeftOverExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], allLeftOverExceptionFilter);
//# sourceMappingURL=all.js.map
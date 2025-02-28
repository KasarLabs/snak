"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ErrorLoggingInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorLoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let ErrorLoggingInterceptor = ErrorLoggingInterceptor_1 = class ErrorLoggingInterceptor {
    constructor() {
        this.logger = new common_1.Logger(ErrorLoggingInterceptor_1.name);
    }
    intercept(context, next) {
        return next.handle().pipe((0, operators_1.catchError)((error) => {
            this.logger.error('Error caught in interceptor:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
            return (0, rxjs_1.throwError)(() => error);
        }));
    }
};
exports.ErrorLoggingInterceptor = ErrorLoggingInterceptor;
exports.ErrorLoggingInterceptor = ErrorLoggingInterceptor = ErrorLoggingInterceptor_1 = __decorate([
    (0, common_1.Injectable)()
], ErrorLoggingInterceptor);
exports.default = ErrorLoggingInterceptor;
//# sourceMappingURL=error-logging.interceptor.js.map
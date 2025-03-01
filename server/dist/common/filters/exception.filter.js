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
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const base_error_1 = require("../errors/base.error");
const configuration_1 = require("../../config/configuration");
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        this.logger.error('Exception caught:', {
            name: exception.name,
            message: exception.message,
            stack: exception.stack,
        });
        if (exception instanceof common_1.HttpException) {
            const status = exception.getStatus();
            return response.status(status).send({
                statusCode: status,
                message: exception.message,
                error: exception.name,
            });
        }
        if (exception instanceof base_error_1.BaseError) {
            const errorResponse = exception.toJSON();
            return response.status(common_1.HttpStatus.BAD_REQUEST).send({
                ...errorResponse,
                statusCode: common_1.HttpStatus.BAD_REQUEST,
            });
        }
        return response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).send({
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            message: this.config.isDevelopment
                ? exception.message
                : 'Internal server error',
            error: exception.name,
        });
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)(),
    __metadata("design:paramtypes", [configuration_1.ConfigurationService])
], GlobalExceptionFilter);
//# sourceMappingURL=exception.filter.js.map
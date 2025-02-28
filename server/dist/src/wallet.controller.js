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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletController = void 0;
const common_1 = require("@nestjs/common");
const wallet_service_1 = require("./services/wallet.service");
const agents_1 = require("./dto/agents");
const file_validator_guard_1 = require("./guard/file-validator.guard");
const fs_1 = require("fs");
const utils_1 = require("./utils");
const agents_factory_1 = require("./agents.factory");
let WalletController = class WalletController {
    constructor(walletService, agentFactory) {
        this.walletService = walletService;
        this.agentFactory = agentFactory;
    }
    async onModuleInit() {
        this.agent = await this.agentFactory.createAgent('wallet', 'agent');
        this.agent.createAgentReactExecutor();
    }
    async handleUserCalldataRequest(userRequest) {
        return await this.walletService.handleUserCalldataRequest(this.agent, userRequest);
    }
    async HandleOutputIAParsing(userRequest) {
        return await this.walletService.HandleOutputIAParsing(userRequest);
    }
    async uploadFile(req) {
        const logger = new common_1.Logger('Upload service');
        logger.debug({ message: 'The file has been uploaded' });
        return {
            status: 'success',
            data: 'The file has been uploaded.',
        };
    }
    async deleteUploadFile(filename) {
        const logger = new common_1.Logger('Delete service');
        const path = process.env.PATH_UPLOAD_DIR;
        if (!path)
            throw new Error(`PATH_UPLOAD_DIR must be defined in .env file`);
        const fullPath = await (0, utils_1.getFilename)(filename.filename);
        const normalizedPath = fullPath.normalize();
        try {
            await fs_1.promises.access(normalizedPath);
        }
        catch {
            throw new common_1.NotFoundException(`File not found : ${path}`);
        }
        try {
            await fs_1.promises.unlink(fullPath);
            logger.debug({ message: `File ${filename.filename} has been deleted` });
            return { status: 'success', data: 'The file has been deleted.' };
        }
        catch (error) {
            logger.error('Error delete file', {
                error: {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                },
                filePath: fullPath,
            });
            switch (error.code) {
                case 'ENOENT':
                    throw new common_1.NotFoundException(`File not found : ${path}${filename.filename}`);
                case 'EACCES':
                    throw new Error(`Insufficient permits for ${path}${filename.filename}`);
                default:
                    throw new Error(`Deletion error : ${error.message}`);
            }
        }
    }
};
exports.WalletController = WalletController;
__decorate([
    (0, common_1.Post)('request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [agents_1.AgentRequestDTO]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "handleUserCalldataRequest", null);
__decorate([
    (0, common_1.Post)('output'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [agents_1.AgentRequestDTO]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "HandleOutputIAParsing", null);
__decorate([
    (0, common_1.Post)('upload_large_file'),
    (0, common_1.UseGuards)(new file_validator_guard_1.FileTypeGuard(['image/jpeg', 'image/png'])),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Post)('delete_large_file'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WalletController.prototype, "deleteUploadFile", null);
exports.WalletController = WalletController = __decorate([
    (0, common_1.Controller)('wallet'),
    __metadata("design:paramtypes", [wallet_service_1.WalletService,
        agents_factory_1.AgentFactory])
], WalletController);
//# sourceMappingURL=wallet.controller.js.map
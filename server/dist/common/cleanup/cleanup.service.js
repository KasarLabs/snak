"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const fs_1 = require("fs");
const path = __importStar(require("path"));
let CleanupService = CleanupService_1 = class CleanupService {
    constructor() {
        this.logger = new common_1.Logger(CleanupService_1.name);
        this.uploadDir = '';
        this.maxAge = 60 * 60 * 1000;
    }
    async handleHourlyCleanup() {
        try {
            this.logger.log('Starting hourly cleanup...');
            const now = Date.now();
            const files = await fs_1.promises.readdir(this.uploadDir);
            for (const file of files) {
                const filePath = path.join(this.uploadDir, file);
                try {
                    const stats = await fs_1.promises.stat(filePath);
                    const fileAge = now - stats.mtime.getTime();
                    if (fileAge > this.maxAge) {
                        await fs_1.promises.unlink(filePath);
                        this.logger.log(`Deleted file: ${file}`);
                    }
                }
                catch (err) {
                    this.logger.error(`Error processing file ${file}:`, err);
                }
            }
            this.logger.log('Hourly cleanup completed');
        }
        catch (error) {
            this.logger.error('Cleanup error:', error);
        }
    }
    onModuleInit() {
        const path = process.env.PATH_UPLOAD_DIR;
        if (typeof path === 'string')
            this.uploadDir = path;
        this.logger.log('Cleanup service initialized');
    }
    onModuleDestroy() {
        this.logger.log('Cleanup service shutdown');
    }
};
exports.CleanupService = CleanupService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CleanupService.prototype, "handleHourlyCleanup", null);
exports.CleanupService = CleanupService = CleanupService_1 = __decorate([
    (0, common_1.Injectable)()
], CleanupService);
//# sourceMappingURL=cleanup.service.js.map
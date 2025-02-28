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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileTypeGuard = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = __importStar(require("path"));
let FileTypeGuard = class FileTypeGuard {
    constructor(allowedMimeTypes = []) {
        this.allowedMimeTypes = allowedMimeTypes;
        this.uploadDir = '';
        this.fileSignatures = [
            {
                mime: 'application/json',
                signatures: [[0x7b], [0x5b]],
            },
            {
                mime: 'application/zip',
                signatures: [[0x50, 0x4b, 0x03, 0x04]],
            },
            {
                mime: 'image/jpeg',
                signatures: [
                    [0xff, 0xd8, 0xff, 0xe0],
                    [0xff, 0xd8, 0xff, 0xe1],
                    [0xff, 0xd8, 0xff, 0xe8],
                ],
            },
            {
                mime: 'image/png',
                signatures: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
            },
        ];
    }
    async canActivate(context) {
        const path = process.env.PATH_UPLOAD_DIR;
        if (typeof path === 'string')
            this.uploadDir = path;
        const request = context.switchToHttp().getRequest();
        if (!request.isMultipart()) {
            throw new common_1.ForbiddenException('The request must be multipart');
        }
        await this.ensureUploadDirExists();
        try {
            const parts = request.parts();
            const uploadedFiles = [];
            for await (const part of parts) {
                if (part.type === 'file') {
                    const file = part;
                    const uploadedFile = await this.saveFile(file);
                    const buffer = await fs_1.promises.readFile(uploadedFile.path);
                    const isFile = await this.validateFile(buffer);
                    if (!isFile) {
                        if (this.allowedMimeTypes.indexOf('application/json') != -1) {
                            const isJson = await this.validateJson(buffer);
                            if (!isJson) {
                                fs_1.promises.unlink(uploadedFile.path);
                                throw new common_1.ForbiddenException('Unauthorized file type');
                            }
                        }
                        throw new common_1.ForbiddenException('Unauthorized file type');
                    }
                    uploadedFiles.push(uploadedFile);
                }
            }
            request.uploadedFiles = uploadedFiles;
            return true;
        }
        catch (error) {
            await this.cleanupFiles();
            console.log(error);
            if (error instanceof common_1.ForbiddenException) {
                throw error;
            }
            throw new common_1.ForbiddenException('File processing error');
        }
    }
    async saveFile(file) {
        const buffer = await file.toBuffer();
        const { name, ext } = path_1.default.parse(file.filename);
        const secret = process.env.SECRET_PHRASE;
        if (!secret) {
            throw new Error('SECRET_PHRASE must be defined in .env file');
        }
        const hash = await this.createHash(`${name}${secret}`);
        const filename = `${hash}${ext}`;
        const filepath = (0, path_1.join)(this.uploadDir, filename);
        await fs_1.promises.writeFile(filepath, buffer);
        const originalSize = buffer.length;
        const writtenSize = (await fs_1.promises.stat(filepath)).size;
        if (originalSize !== writtenSize) {
            throw new Error(`File integrity check failed: original size ${originalSize} != written size ${writtenSize}`);
        }
        return {
            originalName: file.filename,
            filename: filename,
            mimetype: file.mimetype,
            size: buffer.length,
            path: filepath,
        };
    }
    async createHash(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    async ensureUploadDirExists() {
        try {
            await fs_1.promises.access(this.uploadDir);
        }
        catch {
            await fs_1.promises.mkdir(this.uploadDir, { recursive: true });
        }
    }
    async cleanupFiles() {
        try {
            const files = await fs_1.promises.readdir(this.uploadDir);
            for (const file of files) {
                await fs_1.promises.unlink((0, path_1.join)(this.uploadDir, file));
            }
        }
        catch (error) {
            console.error('Error while cleaning files:', error);
        }
    }
    async validateFile(buffer) {
        const fileType = this.detectFileType(buffer);
        if (!fileType) {
            return false;
        }
        return (this.allowedMimeTypes.length === 0 ||
            this.allowedMimeTypes.includes(fileType));
    }
    async validateJson(buffer) {
        try {
            const content = buffer.toString('utf8').trim();
            if (!content.startsWith('{') && !content.startsWith('[')) {
                return false;
            }
            JSON.parse(content);
            return true;
        }
        catch {
            return false;
        }
    }
    detectFileType(buffer) {
        for (const fileSignature of this.fileSignatures) {
            if (this.checkSignature(buffer, fileSignature.signatures)) {
                return fileSignature.mime;
            }
        }
        return null;
    }
    checkSignature(buffer, signatures) {
        return signatures.some((signature) => {
            return signature.every((byte, index) => buffer[index] === byte);
        });
    }
};
exports.FileTypeGuard = FileTypeGuard;
exports.FileTypeGuard = FileTypeGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Array])
], FileTypeGuard);
//# sourceMappingURL=file-validator.guard.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilename = exports.test = void 0;
const common_1 = require("@nestjs/common");
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const test = () => { };
exports.test = test;
const getFilename = async (filename) => {
    const { name, ext } = path_1.default.parse(filename);
    const dirPath = process.env.PATH_UPLOAD_DIR;
    if (!dirPath)
        throw new Error(`PATH_UPLOAD_DIR must be defined in .env file`);
    const secret = process.env.SECRET_PHRASE;
    let filePath;
    if (!secret) {
        filePath = `${dirPath}${filename}`;
    }
    else {
        const hash = await createHash(`${name}${secret}`);
        filePath = `${dirPath}${hash}${ext}`;
    }
    const normalizedPath = filePath.normalize();
    try {
        await fs_1.promises.access(normalizedPath);
    }
    catch {
        throw new common_1.NotFoundException(`File not found : ${filePath}`);
    }
    return filePath;
};
exports.getFilename = getFilename;
const createHash = async (text) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};
//# sourceMappingURL=getFilename.js.map
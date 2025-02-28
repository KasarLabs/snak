import { ExecutionContext, CanActivate } from '@nestjs/common';
export declare class FileTypeGuard implements CanActivate {
    private readonly allowedMimeTypes;
    private uploadDir;
    private readonly fileSignatures;
    constructor(allowedMimeTypes?: string[]);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private saveFile;
    private createHash;
    private ensureUploadDirExists;
    private cleanupFiles;
    private validateFile;
    private validateJson;
    private detectFileType;
    private checkSignature;
}

import {
  Injectable,
  ForbiddenException,
  ExecutionContext,
  CanActivate,
} from '@nestjs/common';
import { MultipartFile } from '@fastify/multipart';
import { FastifyRequest } from 'fastify';
import { promises as fs } from 'fs';
import path, { join } from 'path';

interface FileSignature {
  mime: string;
  signatures: Array<number[]>;
}

interface UploadedFile {
  originalName: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
}

@Injectable()
export class FileTypeGuard implements CanActivate {
  private uploadDir = '';
  private readonly fileSignatures: FileSignature[] = [
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

  constructor(private readonly allowedMimeTypes: string[] = []) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const path = process.env.PATH_UPLOAD_DIR;
    if (typeof path === 'string') this.uploadDir = path;

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (!request.isMultipart()) {
      throw new ForbiddenException('The request must be multipart');
    }
    await this.ensureUploadDirExists();

    try {
      const parts = request.parts();
      const uploadedFiles: UploadedFile[] = [];

      for await (const part of parts) {
        if (part.type === 'file') {
          const file = part as MultipartFile;
          const uploadedFile = await this.saveFile(file);
          const buffer = await fs.readFile(uploadedFile.path);

          const isFile = await this.validateFile(buffer);
          if (!isFile) {
            if (this.allowedMimeTypes.indexOf('application/json') != -1) {
              const isJson = await this.validateJson(buffer);
              if (!isJson) {
                fs.unlink(uploadedFile.path);
                throw new ForbiddenException('Unauthorized file type');
              }
            }
            throw new ForbiddenException('Unauthorized file type');
          }

          uploadedFiles.push(uploadedFile);
        }
      }

      (request as any).uploadedFiles = uploadedFiles;

      return true;
    } catch (error) {
      await this.cleanupFiles();
      console.log(error);

      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('File processing error');
    }
  }

  private async saveFile(file: MultipartFile): Promise<UploadedFile> {
    const buffer = await file.toBuffer();
    const { name, ext } = path.parse(file.filename);

    const secret = process.env.SECRET_PHRASE;
    if (!secret) {
      throw new Error('SECRET_PHRASE must be defined in .env file');
    }

    const hash = await this.createHash(`${name}${secret}`);

    const filename = `${hash}${ext}`;

    const filepath = join(this.uploadDir, filename);

    await fs.writeFile(filepath, buffer);

    const originalSize = buffer.length;
    const writtenSize = (await fs.stat(filepath)).size;

    if (originalSize !== writtenSize) {
      throw new Error(
        `File integrity check failed: original size ${originalSize} != written size ${writtenSize}`
      );
    }

    return {
      originalName: file.filename,
      filename: filename,
      mimetype: file.mimetype,
      size: buffer.length,
      path: filepath,
    };
  }

  private async createHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async ensureUploadDirExists(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  private async cleanupFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.uploadDir);
      for (const file of files) {
        await fs.unlink(join(this.uploadDir, file));
      }
    } catch (error) {
      console.error('Error while cleaning files:', error);
    }
  }

  private async validateFile(buffer: Buffer): Promise<boolean> {
    const fileType = this.detectFileType(buffer);

    if (!fileType) {
      return false;
    }

    return (
      this.allowedMimeTypes.length === 0 ||
      this.allowedMimeTypes.includes(fileType)
    );
  }

  private async validateJson(buffer: Buffer): Promise<boolean> {
    try {
      const content = buffer.toString('utf8').trim();

      if (!content.startsWith('{') && !content.startsWith('[')) {
        return false;
      }

      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  private detectFileType(buffer: Buffer): string | null {
    for (const fileSignature of this.fileSignatures) {
      if (this.checkSignature(buffer, fileSignature.signatures)) {
        return fileSignature.mime;
      }
    }
    return null;
  }

  private checkSignature(buffer: Buffer, signatures: number[][]): boolean {
    return signatures.some((signature) => {
      return signature.every((byte, index) => buffer[index] === byte);
    });
  }
}

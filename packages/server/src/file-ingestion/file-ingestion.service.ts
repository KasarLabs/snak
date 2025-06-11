import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { FileContent, StoredFile } from './file-content.interface.js';
import { ChunkingService } from '../chunking/chunking.service.js';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { VectorStoreService } from '../vector-store/vector-store.service.js';

@Injectable()
export class FileIngestionService {
  private readonly logger = new Logger(FileIngestionService.name);
  private readonly uploadDir =
    process.env.PATH_UPLOAD_DIR || path.join(process.cwd(), 'uploads');

  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async saveFile(buffer: Buffer, originalName: string) {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const filename = `${Date.now()}-${originalName}`;
    const filePath = path.join(this.uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    const { size } = await fs.stat(filePath);
    const fileType = await fileTypeFromBuffer(buffer);
    const mimeType = fileType?.mime || 'application/octet-stream';
    return { id: filename, path: filePath, mimeType, size, originalName };
  }

  private cleanText(text: string) {
    return text.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
  }

  private async parseCsv(buffer: Buffer) {
    return new Promise<string>((resolve, reject) => {
      const rows: string[] = [];
      const stream = Readable.from(buffer);
      stream
        .pipe(csv())
        .on('data', (data) => {
          rows.push(JSON.stringify(data));
        })
        .on('end', () => resolve(rows.join('\n')))
        .on('error', (err) => reject(err));
    });
  }

  private async extractPdf(buffer: Buffer): Promise<string> {
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = (content.items as any[])
        .map((item) => (item as any).str)
        .join(' ');
      text += pageText + '\n';
    }
    return this.cleanText(text);
  }

  private async extractDocx(buffer: Buffer): Promise<string> {
    const { value } = await mammoth.extractRawText({ buffer });
    return this.cleanText(value);
  }

  private async extractRawText(buffer: Buffer, mimeType?: string) {
    const type = mimeType || (await fileTypeFromBuffer(buffer))?.mime || 'text/plain';

    if (type === 'application/pdf') {
      return this.extractPdf(buffer);
    }

    if (
      type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      return this.extractDocx(buffer);
    }

    if (type === 'text/csv' || type === 'application/csv') {
      const csvText = await this.parseCsv(buffer);
      return this.cleanText(csvText);
    }

    if (type === 'application/json' || type === 'text/json') {
      const obj = JSON.parse(buffer.toString('utf8'));
      return JSON.stringify(obj, null, 2);
    }

    // default to text
    const text = buffer.toString('utf8');
    return this.cleanText(text);
  }

  async process(buffer: Buffer, originalName: string): Promise<FileContent> {
    const meta = await this.saveFile(buffer, originalName);
    const text = await this.extractRawText(buffer, meta.mimeType);
    const chunks = await this.chunkingService.chunkText(meta.id, text, {
      chunkSize: 500,
      overlap: 50,
    });

    try {
      const texts = chunks.map((c) => c.text);
      const vectors = await this.embeddingsService.embedDocuments(texts);
      if (vectors.length !== chunks.length) {
        throw new Error('Embedding count mismatch');
      }

      chunks.forEach((chunk, idx) => {
        chunk.metadata.embedding = vectors[idx];
      });

      const upsertPayload = chunks.map((chunk) => ({
        id: chunk.id,
        vector: chunk.metadata.embedding as number[],
        content: chunk.text,
        metadata: {
          documentId: chunk.metadata.documentId,
          chunkIndex: chunk.metadata.chunkIndex,
          originalName: meta.originalName,
          mimeType: meta.mimeType,
        },
      }));
      await this.vectorStore.upsert(upsertPayload);
    } catch (err) {
      this.logger.error('Embedding failed', err as any);
      throw err;
    }

    return {
      chunks,
      metadata: {
        originalName: meta.originalName,
        mimeType: meta.mimeType,
        size: meta.size,
      },
    };
  }

  async listFiles(): Promise<StoredFile[]> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    const entries = await fs.readdir(this.uploadDir);
    const files: StoredFile[] = [];

    for (const entry of entries) {
      const filePath = path.join(this.uploadDir, entry);
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) continue;
      const buffer = await fs.readFile(filePath);
      const type = (await fileTypeFromBuffer(buffer))?.mime || 'application/octet-stream';
      const originalName = entry.substring(entry.indexOf('-') + 1) || entry;
      const timestamp = Number(entry.split('-')[0]);
      files.push({
        id: entry,
        originalName,
        mimeType: type,
        size: stat.size,
        uploadDate: new Date(timestamp || stat.birthtimeMs).toISOString(),
      });
    }
    return files;
  }

  async getFile(id: string): Promise<FileContent> {
    const filePath = path.join(this.uploadDir, id);
    const stat = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);
    const mimeType = (await fileTypeFromBuffer(buffer))?.mime || 'application/octet-stream';
    const originalName = id.substring(id.indexOf('-') + 1) || id;
    const text = await this.extractRawText(buffer, mimeType);
    const chunks = await this.chunkingService.chunkText(id, text, {
      chunkSize: 500,
      overlap: 50,
    });
    return {
      chunks,
      metadata: {
        originalName,
        mimeType,
        size: stat.size,
      },
    };
  }

  async deleteFile(id: string) {
    const filePath = path.join(this.uploadDir, id);
    await fs.unlink(filePath);
  }
}

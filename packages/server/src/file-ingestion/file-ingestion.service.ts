import { Injectable, Logger } from '@nestjs/common';
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

  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
  ) { }

  async saveFile(buffer: Buffer, originalName: string) {
    const filename = `${Date.now()}-${originalName}`;
    const fileType = await fileTypeFromBuffer(buffer);
    const mimeType = fileType?.mime || 'application/octet-stream';
    return { id: filename, mimeType, size: buffer.length, originalName };
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

  private computeChunkParams(size: number) {
    console.log(size);
    const chunkSize =
      size > 1_000_000
        ? 500
        : size > 500_000
          ? 400
          : size > 100_000
            ? 300
            : size > 50_000
              ? 200
              : 100;
    const overlap = Math.round(chunkSize * (chunkSize <= 300 ? 0.2 : 0.1));
    return { chunkSize, overlap };
  }

  async process(buffer: Buffer, originalName: string): Promise<FileContent> {
    const meta = await this.saveFile(buffer, originalName);
    const text = await this.extractRawText(buffer, meta.mimeType);
    const strategy =
      meta.mimeType === 'text/csv' ||
        meta.mimeType === 'application/csv' ||
        meta.mimeType === 'application/json' ||
        meta.mimeType === 'text/json'
        ? 'structured'
        : 'adaptive';
    const { chunkSize, overlap } = this.computeChunkParams(meta.size);
    const chunks = await this.chunkingService.chunkText(meta.id, text, {
      chunkSize,
      overlap,
      strategy,
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
    const docs = await this.vectorStore.listDocuments();
    return docs.map((d) => ({
      id: d.document_id,
      originalName: d.original_name,
      mimeType: d.mime_type,
      size: d.size,
      uploadDate: new Date(Number(d.document_id.split('-')[0]) || Date.now()).toISOString(),
    }));
  }

  async getFile(id: string): Promise<FileContent> {
    const rows = await this.vectorStore.getDocument(id);
    if (!rows.length) {
      throw new Error('Document not found');
    }
    const chunks = rows.map((r) => ({
      id: r.id,
      text: r.content,
      metadata: {
        documentId: id,
        chunkIndex: r.chunk_index,
        startToken: 0,
        endToken: 0,
      },
    }));
    const size = rows.reduce((acc, r) => acc + r.content.length, 0);
    return {
      chunks,
      metadata: {
        originalName: rows[0].original_name,
        mimeType: rows[0].mime_type,
        size,
      },
    };

  }

  async deleteFile(id: string) {
    await this.vectorStore.deleteDocument(id);
  }
}

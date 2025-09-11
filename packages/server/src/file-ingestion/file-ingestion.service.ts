import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.js';
import { fileTypeFromBuffer } from 'file-type';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { FileContent, StoredFile } from './file-content.interface.js';
import { ChunkingService } from '../chunking/chunking.service.js';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { VectorStoreService } from '../vector-store/vector-store.service.js';
import { Postgres } from '@snakagent/database';

@Injectable()
export class FileIngestionService {
  private readonly logger = new Logger(FileIngestionService.name);

  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStore: VectorStoreService,
    private readonly config: ConfigurationService
  ) {}

  /**
   * Verify that the agent belongs to the specified user
   * @param agentId - The agent ID to verify
   * @param userId - The user ID to check ownership against
   * @throws ForbiddenException if the agent doesn't belong to the user
   */
  private async verifyAgentOwnership(
    agentId: string,
    userId: string
  ): Promise<void> {
    const q = new Postgres.Query(
      'SELECT id FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const result = await Postgres.query(q);

    if (result.length === 0) {
      throw new ForbiddenException('Agent not found or access denied');
    }
  }

  async saveFile(buffer: Buffer, originalName: string) {
    const filename = `${Date.now()}-${originalName}`;
    const fileType = await fileTypeFromBuffer(buffer);
    const mimeType = fileType?.mime || 'application/octet-stream';
    return { id: filename, mimeType, size: buffer.length, originalName };
  }

  private cleanText(text: string) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
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
      const pageText = content.items
        .map((item) => {
          if (typeof item === 'object' && item !== null && 'str' in item) {
            return String(item.str);
          }
          return '';
        })
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
    const type =
      mimeType || (await fileTypeFromBuffer(buffer))?.mime || 'text/plain';

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

  async process(
    agentId: string,
    buffer: Buffer,
    originalName: string,
    userId: string
  ): Promise<FileContent> {
    await this.verifyAgentOwnership(agentId, userId);
    const meta = await this.saveFile(buffer, originalName);
    const agentSize = await this.vectorStore.getAgentSize(agentId, userId);
    const totalSize = await this.vectorStore.getTotalSize();
    const { maxAgentSize, maxProcessSize } = this.config.rag;

    if (agentSize + meta.size > maxAgentSize) {
      throw new Error('Agent rag storage limit exceeded');
    }
    if (totalSize + meta.size > maxProcessSize) {
      throw new Error('Process rag storage limit exceeded');
    }
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
      await this.vectorStore.upsert(agentId, upsertPayload, userId);
    } catch (err) {
      this.logger.error('Embedding failed', err);
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

  async listFiles(agentId: string, userId: string): Promise<StoredFile[]> {
    await this.verifyAgentOwnership(agentId, userId);
    const docs = await this.vectorStore.listDocuments(agentId, userId);
    return docs.map((d) => ({
      id: d.document_id,
      originalName: d.original_name,
      mimeType: d.mime_type,
      size: d.size,
      uploadDate: new Date(
        Number(d.document_id.split('-')[0]) || Date.now()
      ).toISOString(),
    }));
  }

  async getFile(
    agentId: string,
    id: string,
    userId: string
  ): Promise<FileContent> {
    await this.verifyAgentOwnership(agentId, userId);
    const rows = await this.vectorStore.getDocument(agentId, id, userId);
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

  async deleteFile(agentId: string, id: string, userId: string) {
    await this.verifyAgentOwnership(agentId, userId);
    await this.vectorStore.deleteDocument(agentId, id, userId);
  }
}

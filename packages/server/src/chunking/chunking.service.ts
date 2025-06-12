import { Injectable } from '@nestjs/common';
import { Chunk } from './chunk.interface.js';

export interface ChunkOptions {
  chunkSize: number;
  overlap: number;
  strategy?: 'adaptive' | 'whitespace' | 'structured';
}

@Injectable()
export class ChunkingService {
  async chunkText(
    documentId: string,
    text: string,
    options: ChunkOptions,
  ): Promise<Chunk[]> {
    const { chunkSize, overlap, strategy = 'adaptive' } = options;
    if (strategy === 'whitespace') {
      return this.chunkByWhitespace(documentId, text, chunkSize, overlap);
    }
    if (strategy === 'structured') {
      return this.chunkStructured(documentId, text, chunkSize, overlap);
    }
    return this.chunkAdaptive(documentId, text, chunkSize, overlap);
  }

  private chunkByWhitespace(
    documentId: string,
    text: string,
    chunkSize: number,
    overlap: number,
  ): Chunk[] {
    const tokens = text.split(/\s+/);
    const chunks: Chunk[] = [];
    let index = 0;

    for (let start = 0; start < tokens.length; start += chunkSize - overlap) {
      const end = Math.min(start + chunkSize, tokens.length);
      const chunkTokens = tokens.slice(start, end);
      chunks.push({
        id: `${documentId}-${index}`,
        text: chunkTokens.join(' '),
        metadata: {
          documentId,
          chunkIndex: index++,
          startToken: start,
          endToken: end,
        },
      });
      if (end === tokens.length) {
        break;
      }
    }

    return chunks;
  }
  private chunkAdaptive(
    documentId: string,
    text: string,
    chunkSize: number,
    overlap: number,
  ): Chunk[] {
    const lines = text.split(/\n/);
    const segments: { text: string; heading: boolean }[] = [];
    let current = '';
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === '') {
        if (current) {
          segments.push({ text: current, heading: false });
          current = '';
        }
        continue;
      }
      if (/^#+\s+/.test(line)) {
        if (current) {
          segments.push({ text: current, heading: false });
          current = '';
        }
        segments.push({ text: line, heading: true });
        continue;
      }
      current = current ? `${current} ${line}` : line;
    }
    if (current) {
      segments.push({ text: current, heading: false });
    }

    const chunks: Chunk[] = [];
    let index = 0;
    let currentTokens: string[] = [];
    let startToken = 0;

    const flush = () => {
      if (!currentTokens.length) return;
      const end = Math.min(chunkSize, currentTokens.length);
      const chunkTokens = currentTokens.slice(0, end);
      const endToken = startToken + chunkTokens.length;
      chunks.push({
        id: `${documentId}-${index}`,
        text: chunkTokens.join(' '),
        metadata: {
          documentId,
          chunkIndex: index++,
          startToken,
          endToken,
        },
      });
      const overlapTokens = chunkTokens.slice(Math.max(0, end - overlap));
      currentTokens = overlapTokens.concat(currentTokens.slice(end));
      startToken = endToken - overlap;
    };

    for (const seg of segments) {
      const segTokens = seg.text.split(/\s+/);
      if (seg.heading) {
        flush();
        currentTokens.push(...segTokens);
        if (currentTokens.length >= chunkSize) {
          flush();
        }
        continue;
      }

      if (currentTokens.length + segTokens.length > chunkSize) {
        flush();
      }
      currentTokens.push(...segTokens);

      while (currentTokens.length >= chunkSize) {
        flush();
      }
    }

    if (currentTokens.length) {
      flush();
    }

    return chunks;
  }
  private chunkStructured(
    documentId: string,
    text: string,
    chunkSize: number,
    overlap: number,
  ): Chunk[] {
    const lines = text.split(/\n/);
    const chunks: Chunk[] = [];
    let index = 0;
    let currentTokens: string[] = [];
    let startToken = 0;

    const flush = () => {
      if (!currentTokens.length) return;
      const end = Math.min(chunkSize, currentTokens.length);
      const chunkTokens = currentTokens.slice(0, end);
      const endToken = startToken + chunkTokens.length;
      chunks.push({
        id: `${documentId}-${index}`,
        text: chunkTokens.join(' '),
        metadata: {
          documentId,
          chunkIndex: index++,
          startToken,
          endToken,
        },
      });
      const overlapTokens = chunkTokens.slice(Math.max(0, end - overlap));
      currentTokens = overlapTokens.concat(currentTokens.slice(end));
      startToken = endToken - overlap;
    };

    for (const line of lines) {
      const lineTokens = line.trim().split(/\s+/);
      if (currentTokens.length + lineTokens.length > chunkSize) {
        flush();
      }
      currentTokens.push(...lineTokens);

      while (currentTokens.length >= chunkSize) {
        flush();
      }
    }

    if (currentTokens.length) {
      flush();
    }

    return chunks;
  }
}
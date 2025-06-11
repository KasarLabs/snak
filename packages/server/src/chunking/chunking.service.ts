import { Injectable } from '@nestjs/common';
import { Chunk } from './chunk.interface.js';

export interface ChunkOptions {
  chunkSize: number;
  overlap: number;
}

@Injectable()
export class ChunkingService {
  // Very basic whitespace tokenizer chunking implementation
  async chunkText(
    documentId: string,
    text: string,
    options: ChunkOptions,
  ): Promise<Chunk[]> {
    const tokens = text.split(/\s+/);
    const { chunkSize, overlap } = options;
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
}
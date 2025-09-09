import { Injectable } from '@nestjs/common';
import { CustomHuggingFaceEmbeddings, logger } from '@snakagent/core';

@Injectable()
export class EmbeddingsService {
  private embeddings = new CustomHuggingFaceEmbeddings({
    model: 'Xenova/all-MiniLM-L6-v2',
    dtype: 'fp32',
  });

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new TypeError('Input must be a non-empty array of strings');
    }

    if (texts.some((t) => typeof t !== 'string' || t.trim().length === 0)) {
      throw new TypeError('All input elements must be non-empty strings');
    }
    try {
      const vectors = await this.embeddings.embedDocuments(texts);

      return vectors;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Embedding generation failed', error);
      throw err;
    }
  }
}

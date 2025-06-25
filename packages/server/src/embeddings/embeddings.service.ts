import { Injectable } from '@nestjs/common';
import { CustomHuggingFaceEmbeddings } from '@snakagent/core';

@Injectable()
export class EmbeddingsService {
  private embeddings = new CustomHuggingFaceEmbeddings({
    model: 'Xenova/all-MiniLM-L6-v2',
    dtype: 'fp32',
  });

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Input must be a non-empty array of strings');
    }

    if (texts.some((text) => typeof text !== 'string')) {
      throw new Error('All input elements must be strings');
    }
    return this.embeddings.embedDocuments(texts);
  }
}

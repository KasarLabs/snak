import { Injectable } from '@nestjs/common';
import { CustomHuggingFaceEmbeddings } from './customEmbedding.js';

@Injectable()
export class EmbeddingsService {
  private embeddings = new CustomHuggingFaceEmbeddings({
    model: 'Xenova/all-MiniLM-L6-v2',
    dtype: 'fp32',
  });

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }
}
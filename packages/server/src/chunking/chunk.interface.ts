export interface ChunkMetadata {
  documentId: string;
  chunkIndex: number;
  startToken: number;
  endToken: number;
  embedding?: number[];
}

export interface Chunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}
export interface Chunk {
  id: string;
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  documentId: string;
  chunkIndex: number;
  startToken: number;
  endToken: number;
  embedding?: number[];
}

export interface FileContent {
  chunks: Chunk[];
  metadata: {
    originalName: string;
    mimeType: string;
    size: number;
  };
}

export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadDate: string;
}

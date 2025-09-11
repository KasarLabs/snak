import { Chunk } from '../chunking/chunk.interface.js';

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
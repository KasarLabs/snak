import { Chunk } from '@snakagent/core';

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

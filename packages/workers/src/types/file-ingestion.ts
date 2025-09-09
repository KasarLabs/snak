/**
 * File ingestion types for workers package
 * Defines interfaces and types for file processing, metadata, and results
 */

/**
 * Base interface for file content
 */
export interface FileContent {
  id: string;
  content: string;
  metadata: FileMetadata;
}

/**
 * Interface for stored file information
 */
export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: SupportedMimeType;
  size: number;
  uploadedAt: Date;
  agentId: string;
  userId: string;
  documentId: string;
}

/**
 * File metadata interface
 */
export interface FileMetadata {
  documentId: string;
  originalName: string;
  mimeType: SupportedMimeType;
  size: number;
  uploadedAt: Date;
  agentId: string;
  userId: string;
  chunkIndex?: number;
  startToken?: number;
  endToken?: number;
  embedding?: number[];
}

/**
 * File processing options
 */
export interface FileProcessingOptions {
  chunkSize: number;
  overlap: number;
  strategy: 'adaptive' | 'whitespace' | 'structured';
  generateEmbeddings: boolean;
  storeInVectorDB: boolean;
  contentEncoding?: 'utf8' | 'base64';
}

/**
 * File processing result
 */
export interface FileProcessingResult {
  documentId: string;
  originalName: string;
  mimeType: SupportedMimeType;
  size: number;
  chunksCount: number;
  embeddingsCount: number;
  success: boolean;
  error?: string;
  processingTime: number;
  agentId: string;
  userId: string;
}

/**
 * File ingestion job data
 */
export interface FileIngestionJobData {
  documentId: string;
  agentId: string;
  userId: string;
  originalName: string;
  mimeType: SupportedMimeType;
  content: string | Uint8Array;
  size: number;
  options?: Partial<FileProcessingOptions>;
}

/**
 * File ingestion job result
 */
export type FileIngestionJobResult =
  | { success: true; result: FileProcessingResult; retryable: boolean }
  | { success: false; error: string; retryable: boolean };

/**
 * Supported file types
 */
export type SupportedMimeType =
  | 'text/plain'
  | 'text/markdown'
  | 'application/pdf'
  | 'application/msword'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'text/csv'
  | 'application/csv'
  | 'application/json'
  | 'text/html';

/**
 * File type validation result
 */
export interface FileTypeValidation {
  isValid: boolean;
  mimeType: SupportedMimeType;
  supported: boolean;
  error?: string;
}

/**
 * Chunk processing result
 */
export interface ChunkProcessingResult {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadata: ChunkMetadata;
  success: boolean;
  error?: string;
}

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  documentId: string;
  chunkIndex: number;
  startToken: number;
  endToken: number;
  originalName: string;
  mimeType: SupportedMimeType;
  embedding?: number[];
}

/**
 * Vector store entry
 */
export interface VectorStoreEntry {
  id: string;
  vector: number[];
  content: string;
  metadata: {
    documentId: string;
    chunkIndex: number;
    originalName: string;
    mimeType: SupportedMimeType;
  };
}

/**
 * File ingestion status
 */
export enum FileIngestionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * File ingestion progress
 */
export interface FileIngestionProgress {
  documentId: string;
  status: FileIngestionStatus;
  progress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  error?: string;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

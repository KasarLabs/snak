/**
 * Generic job types for workers package
 * Defines interfaces and types for job management, metadata, and persistence
 */

import type { JobStatus, JobType } from './index.js';

/**
 * Job metadata stored in database
 */
export interface JobMetadata {
  id: string;
  jobId?: string; // Alias for backward compatibility
  type: JobType;
  status: JobStatus;
  agentId?: string;
  userId: string;
  payload: Record<string, any>;
  result?: Record<string, any>;
  error?: string;
  createdAt: Date;
  updatedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}

/**
 * Job creation payload
 */
export interface CreateJobPayload {
  type: JobType;
  agentId?: string;
  userId: string;
  payload: Record<string, any>;
  maxRetries?: number;
}

/**
 * Job creation metadata data (alias for backward compatibility)
 */
export interface CreateJobMetadataData extends CreateJobPayload {
  jobId?: string;
  status?: JobStatus;
}

/**
 * Job update payload
 */
export interface UpdateJobPayload {
  status?: JobStatus;
  result?: Record<string, any>;
  error?: string;
  retryCount?: number;
}

/**
 * Job update metadata data (alias for backward compatibility)
 */
export interface UpdateJobMetadataData extends UpdateJobPayload {
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Job query filters
 */
export interface JobQueryFilters {
  type?: JobType;
  status?: JobStatus;
  agentId?: string;
  userId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Job metadata filters (alias for backward compatibility)
 */
export interface JobMetadataFilters extends JobQueryFilters {}

/**
 * Job statistics
 */
export interface JobStatistics {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
  byType: Record<JobType, number>;
  byStatus: Record<JobStatus, number>;
}

/**
 * Job retry configuration
 */
export interface JobRetryConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  backoffMultiplier: number;
  maxRetryDelay: number; // milliseconds
}

/**
 * Job processing context
 */
export interface JobProcessingContext {
  jobId: string;
  type: JobType;
  payload: Record<string, any>;
  metadata: JobMetadata;
  retryCount: number;
  maxRetries: number;
}

/**
 * Job result interface (generic)
 */
export interface JobResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
  processingTime?: number;
}

/**
 * Job result for retrieval operations (specific interface)
 */
export interface JobRetrievalResult {
  jobId: string;
  agentId?: string;
  userId: string;
  status: ResultStatus;
  data?: unknown;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  source: ResultSource;
  regenerated?: boolean;
}

/**
 * Job service interface
 */
export interface IJobMetadataService {
  createJob(payload: CreateJobPayload): Promise<string>;
  getJob(jobId: string): Promise<JobMetadata | null>;
  updateJob(jobId: string, updates: UpdateJobMetadataData): Promise<void>;
  deleteJob(jobId: string): Promise<void>;
  listJobs(filters: JobQueryFilters): Promise<JobMetadata[]>;
  getJobStatistics(filters?: Partial<JobQueryFilters>): Promise<JobStatistics>;
  cleanupExpiredJobs(olderThan: Date): Promise<number>;
}

/**
 * Job processor interface
 */
export interface IJobProcessor<T = any> {
  process(context: JobProcessingContext): Promise<JobResult<T>>;
  onSuccess?(
    context: JobProcessingContext,
    result: JobResult<T>
  ): Promise<void>;
  onFailure?(context: JobProcessingContext, error: Error): Promise<void>;
  onRetry?(context: JobProcessingContext, error: Error): Promise<void>;
}

/**
 * Job queue configuration
 */
export interface JobQueueConfig {
  name: string;
  concurrency: number;
  retryConfig: JobRetryConfig;
  timeout?: number; // milliseconds
  removeOnComplete?: number | boolean;
  removeOnFail?: number | boolean;
}

/**
 * Job monitoring data
 */
export interface JobMonitoringData {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  processingRate: number; // jobs per minute
  averageProcessingTime: number; // milliseconds
  errorRate: number; // percentage
}

/**
 * Job event types
 */
export enum JobEventType {
  CREATED = 'created',
  STARTED = 'started',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DELETED = 'deleted',
}

/**
 * Job event payload
 */
export interface JobEvent {
  type: JobEventType;
  jobId: string;
  jobType: JobType;
  timestamp: Date;
  data?: Record<string, any>;
}

/**
 * Job event handler interface
 */
export interface IJobEventHandler {
  handle(event: JobEvent): Promise<void>;
}

/**
 * Job cleanup configuration
 */
export interface JobCleanupConfig {
  completedJobsRetentionDays: number;
  failedJobsRetentionDays: number;
  pendingJobsTimeoutHours: number;
  cleanupIntervalHours: number;
}

/**
 * Job health check result
 */
export interface JobHealthCheck {
  healthy: boolean;
  issues: string[];
  metrics: {
    totalJobs: number;
    failedJobs: number;
    stuckJobs: number;
    averageProcessingTime: number;
  };
}

/**
 * Options for result retrieval
 */
export interface ResultRetrievalOptions {
  allowRegeneration?: boolean;
  maxRetries?: number;
  timeout?: number;
  fallbackToBull?: boolean;
}

/**
 * Options for result regeneration
 */
export interface ResultRegenerationOptions {
  forceRegeneration?: boolean;
  preserveOriginalData?: boolean;
  timeout?: number;
}

/**
 * Source of job result
 */
export enum ResultSource {
  CACHE = 'cache',
  DATABASE = 'database',
  BULL = 'bull',
  REGENERATED = 'regenerated',
}

/**
 * Status of job result
 */
export enum ResultStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
  PROCESSING = 'processing',
  NOT_FOUND = 'not_found',
}

/**
 * Worker-specific types for workers package
 * Defines interfaces and types for worker management, configuration, and monitoring
 */

import { JobType, JobStatus } from './index.js';

/**
 * Worker configuration interface
 */
export interface WorkerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  queues: {
    fileIngestion: string;
    embeddings: string;
  };
  concurrency: {
    fileIngestion: number;
    embeddings: number;
    fallbackWorkers: number;
    workerIdleTimeout: number;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number; // milliseconds
    healthCheckInterval: number; // milliseconds
  };
}

/**
 * Queue metrics interface
 */
export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Worker status
 */
export enum WorkerStatus {
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Worker instance information
 */
export interface WorkerInstance {
  id: string;
  status: WorkerStatus;
  startedAt: Date;
  lastHeartbeat: Date;
  processedJobs: number;
  failedJobs: number;
  currentJobs: string[];
  capabilities: JobType[];
}

/**
 * Worker health check result
 */
export interface WorkerHealthCheck {
  healthy: boolean;
  status: WorkerStatus;
  issues: string[];
  metrics: {
    uptime: number; // milliseconds
    processedJobs: number;
    failedJobs: number;
    currentLoad: number; // percentage
    memoryUsage: number; // bytes
    cpuUsage: number; // percentage
  };
}

/**
 * Worker event types
 */
export enum WorkerEventType {
  STARTED = 'started',
  STOPPED = 'stopped',
  PAUSED = 'paused',
  RESUMED = 'resumed',
  ERROR = 'error',
  JOB_STARTED = 'job_started',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',
}

/**
 * Worker event payload
 */
export interface WorkerEvent {
  type: WorkerEventType;
  workerId: string;
  timestamp: Date;
  data?: Record<string, any>;
}

/**
 * Worker manager interface
 */
export interface IWorkerManager {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  getStatus(): WorkerStatus;
  getInstances(): WorkerInstance[];
  getHealthCheck(): Promise<WorkerHealthCheck>;
  on(event: WorkerEventType, handler: (event: WorkerEvent) => void): void;
  off(event: WorkerEventType, handler: (event: WorkerEvent) => void): void;
}

/**
 * Job processor factory interface
 */
export interface IJobProcessorFactory {
  createProcessor(type: JobType): any;
  registerProcessor(type: JobType, processor: any): void;
  getSupportedTypes(): JobType[];
}

/**
 * Worker scaling configuration
 */
export interface WorkerScalingConfig {
  minWorkers: number;
  maxWorkers: number;
  scaleUpThreshold: number; // queue size
  scaleDownThreshold: number; // queue size
  scaleUpCooldown: number; // milliseconds
  scaleDownCooldown: number; // milliseconds
}

/**
 * Worker monitoring configuration
 */
export interface WorkerMonitoringConfig {
  enabled: boolean;
  metricsInterval: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enablePrometheus: boolean;
  prometheusPort?: number;
}

/**
 * Worker performance metrics
 */
export interface WorkerPerformanceMetrics {
  workerId: string;
  timestamp: Date;
  jobsProcessed: number;
  jobsFailed: number;
  averageProcessingTime: number; // milliseconds
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  queueSize: number;
  errorRate: number; // percentage
}

/**
 * Worker configuration validation result
 */
export interface WorkerConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Worker startup options
 */
export interface WorkerStartupOptions {
  gracefulShutdown: boolean;
  shutdownTimeout: number; // milliseconds
  enableHealthChecks: boolean;
  enableMetrics: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

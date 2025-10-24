import { BaseError } from './base.error.js';
import { ErrorType, ErrorMetadata } from './error.type.js';

export class JobNotFoundError extends BaseError {
  constructor(jobId: string, metadata?: ErrorMetadata) {
    super(ErrorType.JOB_NOT_FOUND, `Job ${jobId} not found`, {
      ...(metadata ?? {}),
      jobId,
    });
  }
}

export class JobNotCompletedError extends BaseError {
  constructor(jobId: string, status: string, metadata?: ErrorMetadata) {
    super(
      ErrorType.JOB_NOT_COMPLETED,
      `Job ${jobId} is not completed yet. Current status: ${status}`,
      { ...(metadata ?? {}), jobId, status }
    );
  }
}

export class JobFailedError extends BaseError {
  constructor(jobId: string, reason?: string, metadata?: ErrorMetadata) {
    super(ErrorType.JOB_FAILED, reason || `Job ${jobId} failed`, {
      ...(metadata ?? {}),
      jobId,
      reason,
    });
  }
}

export class JobAccessDeniedError extends BaseError {
  constructor(jobId: string, userId: string, metadata?: ErrorMetadata) {
    super(ErrorType.JOB_ACCESS_DENIED, `Access denied to job ${jobId}`, {
      ...(metadata ?? {}),
      jobId,
      userId,
    });
  }
}

export class UnknownJobStatusError extends BaseError {
  constructor(jobId: string, status: string, metadata?: ErrorMetadata) {
    super(ErrorType.JOB_UNKNOWN_STATUS, `Unknown job status: ${status}`, {
      ...(metadata ?? {}),
      jobId,
      status,
    });
  }
}

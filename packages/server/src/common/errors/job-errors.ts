export class JobNotFoundError extends Error {
  constructor(public readonly jobId: string) {
    super(`Job ${jobId} not found`);
    this.name = 'JobNotFoundError';
  }
}

export class JobNotCompletedError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly status: string
  ) {
    super(`Job ${jobId} is not completed yet. Current status: ${status}`);
    this.name = 'JobNotCompletedError';
  }
}

export class JobFailedError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly reason?: string
  ) {
    super(reason || `Job ${jobId} failed`);
    this.name = 'JobFailedError';
  }
}

export class JobAccessDeniedError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly userId: string
  ) {
    super(`Access denied to job ${jobId}`);
    this.name = 'JobAccessDeniedError';
  }
}

export class UnknownJobStatusError extends Error {
  constructor(
    public readonly jobId: string,
    public readonly status: string
  ) {
    super(`Unknown job status: ${status}`);
    this.name = 'UnknownJobStatusError';
  }
}

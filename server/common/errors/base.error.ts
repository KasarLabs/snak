import { ErrorType, ErrorMetadata, ErrorResponse } from './error.types';

export class BaseError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly metadata?: ErrorMetadata
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      type: this.type,
      message: this.message,
      metadata: this.metadata,
    };
  }
}

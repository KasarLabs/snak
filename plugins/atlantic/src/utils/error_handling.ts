export enum ErrorType {
  // Application Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Starknet Errors
  STARKNET_TRANSACTION_ERROR = 'STARKNET_TRANSACTION_ERROR',
  STARKNET_RPC_ERROR = 'STARKNET_RPC_ERROR',

  // Agent Errors
  AGENT_EXECUTION_ERROR = 'AGENT_EXECUTION_ERROR',
  AGENT_INITIALIZATION_ERROR = 'AGENT_INITIALIZATION_ERROR',
}

export interface ErrorMetadata {
  [key: string]: unknown;
}

export interface ErrorResponse {
  type: ErrorType;
  message: string;
  metadata?: ErrorMetadata;
}

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

export class ValidationError extends BaseError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(ErrorType.VALIDATION_ERROR, message, metadata);
  }
}

export class NotFoundError extends BaseError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(ErrorType.NOT_FOUND, message, metadata);
  }
}

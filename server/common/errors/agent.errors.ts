import { BaseError } from './base.error';
import { ErrorType, ErrorMetadata } from './error.types';

export class AgentExecutionError extends BaseError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(ErrorType.AGENT_EXECUTION_ERROR, message, metadata);
  }
}

export class AgentInitializationError extends BaseError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(ErrorType.AGENT_INITIALIZATION_ERROR, message, metadata);
  }
}

export class AgentValidationError extends Error {
  public readonly details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'AgentValidationError';
    this.details = details;
  }
}

export class AgentCredentialsError extends Error {
  public readonly details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'AgentCredentialsError';
    this.details = details;
  }
}

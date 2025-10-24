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

  // Job Errors
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  JOB_NOT_COMPLETED = 'JOB_NOT_COMPLETED',
  JOB_FAILED = 'JOB_FAILED',
  JOB_ACCESS_DENIED = 'JOB_ACCESS_DENIED',
  JOB_UNKNOWN_STATUS = 'JOB_UNKNOWN_STATUS',
}

export interface ErrorMetadata {
  [key: string]: unknown;
}

export interface ErrorResponse {
  type: ErrorType;
  message: string;
  metadata?: ErrorMetadata;
}

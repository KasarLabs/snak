import { BaseError } from './base.error.js';
import { ErrorType, ErrorMetadata } from './error.types.js';

export class StarknetTransactionError extends BaseError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(ErrorType.STARKNET_TRANSACTION_ERROR, message, metadata);
  }
}

export class StarknetRpcError extends BaseError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(ErrorType.STARKNET_RPC_ERROR, message, metadata);
  }
}

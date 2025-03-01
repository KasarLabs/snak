import { BaseError } from './base.error';
import { ErrorType, ErrorMetadata } from './error.types';

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

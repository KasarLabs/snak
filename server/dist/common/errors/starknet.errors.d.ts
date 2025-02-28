import { BaseError } from './base.error';
import { ErrorMetadata } from './error.types';
export declare class StarknetTransactionError extends BaseError {
    constructor(message: string, metadata?: ErrorMetadata);
}
export declare class StarknetRpcError extends BaseError {
    constructor(message: string, metadata?: ErrorMetadata);
}

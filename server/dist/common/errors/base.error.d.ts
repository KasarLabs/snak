import { ErrorType, ErrorMetadata, ErrorResponse } from './error.types';
export declare class BaseError extends Error {
    readonly type: ErrorType;
    readonly metadata?: ErrorMetadata | undefined;
    constructor(type: ErrorType, message: string, metadata?: ErrorMetadata | undefined);
    toJSON(): ErrorResponse;
}

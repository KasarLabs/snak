import { BaseError } from './base.error';
import { ErrorMetadata } from './error.types';
export declare class ValidationError extends BaseError {
    constructor(message: string, metadata?: ErrorMetadata);
}
export declare class NotFoundError extends BaseError {
    constructor(message: string, metadata?: ErrorMetadata);
}
export declare class UnauthorizedError extends BaseError {
    constructor(message: string, metadata?: ErrorMetadata);
}
export declare class ForbiddenError extends BaseError {
    constructor(message: string, metadata?: ErrorMetadata);
}

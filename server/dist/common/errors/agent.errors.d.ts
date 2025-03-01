import { BaseError } from './base.error';
import { ErrorMetadata } from './error.types';
export declare class AgentExecutionError extends BaseError {
    constructor(message: string, metadata?: ErrorMetadata);
}
export declare class AgentInitializationError extends BaseError {
    constructor(message: string, metadata?: ErrorMetadata);
}
export declare class AgentValidationError extends Error {
    readonly details?: any;
    constructor(message: string, details?: any);
}
export declare class AgentCredentialsError extends Error {
    readonly details?: any;
    constructor(message: string, details?: any);
}

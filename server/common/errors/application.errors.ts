import { BaseError } from './base.error';
import { ErrorType, ErrorMetadata } from './error.types';

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

export class UnauthorizedError extends BaseError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(ErrorType.UNAUTHORIZED, message, metadata);
  }
}

export class ForbiddenError extends BaseError {
  constructor(message: string, metadata?: ErrorMetadata) {
    super(ErrorType.FORBIDDEN, message, metadata);
  }
}

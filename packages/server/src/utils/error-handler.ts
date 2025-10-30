import {
  HttpException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { logger } from '@snakagent/core';
import { ServerError } from './error.js';
import {
  JobNotFoundError,
  JobNotCompletedError,
  JobFailedError,
  JobAccessDeniedError,
  UnknownJobStatusError,
} from '../../common/errors/job.errors.js';
import { ValidationError } from '../../common/errors/application.errors.js';

/**
 * Centralized error handler that logs and re-throws appropriate errors
 */
export class ErrorHandler {
  /**
   * Standard try-catch wrapper for controller methods
   * @param operation - The async operation to execute
   * @param context - Context string for logging (e.g., 'updateAgentConfig')
   * @param fallbackErrorCode - ServerError code to use if no specific handling applies
   */
  static async handleControllerError<T>(
    operation: () => Promise<T> | T,
    context: string,
    fallbackErrorCode?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      logger.error(`Error in ${context}:`, error);

      // Re-throw known exceptions as-is
      if (
        error instanceof HttpException ||
        error instanceof ServerError ||
        error instanceof WsException
      ) {
        throw error;
      }

      // Handle job-specific errors
      if (error instanceof JobNotFoundError) {
        throw new NotFoundException(error.message, { cause: error });
      }
      if (error instanceof JobAccessDeniedError) {
        throw new ForbiddenException(
          'Access denied: Job does not belong to user',
          { cause: error }
        );
      }
      if (error instanceof JobNotCompletedError) {
        throw new BadRequestException(error.message, { cause: error });
      }
      if (error instanceof JobFailedError) {
        throw new InternalServerErrorException(`Job failed: ${error.message}`, {
          cause: error,
        });
      }
      if (error instanceof UnknownJobStatusError) {
        throw new InternalServerErrorException(
          `Unknown job status: ${error.message}`,
          { cause: error }
        );
      }

      // Fallback error handling
      if (fallbackErrorCode) {
        throw new ServerError(fallbackErrorCode);
      }

      throw new InternalServerErrorException(`${context} failed`, {
        cause: error,
      });
    }
  }

  /**
   * Handler for operations that should preserve BadRequestException but wrap others
   * @param operation - The async operation to execute
   * @param context - Context string for logging
   * @param errorMessage - Custom error message for wrapped exceptions
   */
  static async handleWithBadRequestPreservation<T>(
    operation: () => Promise<T> | T,
    context: string,
    errorMessage?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      logger.error(`Error in ${context}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      const message = errorMessage || `${context} failed: ${error.message}`;
      throw new BadRequestException(message);
    }
  }

  /**
   * WebSocket-specific error handler
   * @param operation - The async operation to execute
   * @param context - Context string for logging
   * @param client - WebSocket client for emitting errors
   * @param eventName - Event name to emit on error
   * @param fallbackErrorCode - ServerError code for unexpected errors
   */
  static async handleWebSocketError<T>(
    operation: () => Promise<T> | T,
    context: string,
    client: { emit(event: string, payload: unknown): void },
    eventName: string,
    fallbackErrorCode: string = 'E01TA400'
  ): Promise<T | void> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ServerError) {
        logger.error(`ServerError in ${context}:`, {
          errorCode: error.errorCode,
          message: error.message,
          statusCode: error.statusCode,
        });
        client.emit(eventName, error);
        return;
      }

      if (error instanceof WsException) {
        const reason =
          (typeof (error as any).getError === 'function'
            ? (error as any).getError()
            : undefined) ??
          error.message ??
          'Validation failed';
        const validationError = new ValidationError(String(reason));
        client.emit(eventName, validationError);
        return;
      }

      logger.error(`Unexpected error in ${context}:`, error);
      const serverError = new ServerError(fallbackErrorCode);
      client.emit(eventName, serverError);
    }
  }
}

/**
 * Utility class for creating standardized response objects
 */
export class ResponseFormatter {
  /**
   * Creates a success response with the AgentResponse format
   * @param data - The data to include in the response
   */
  static success<T>(data: T): { status: 'success'; data: T } {
    return {
      status: 'success',
      data,
    };
  }

  /**
   * Creates a failure response with the AgentResponse format
   * @param error - The error message or details
   * @param data - Optional data to include with the error
   */
  static failure<T = unknown>(
    error: string,
    data?: T
  ): { status: 'failure'; error: string; data?: T } {
    const response: { status: 'failure'; error: string; data?: T } = {
      status: 'failure',
      error,
    };

    if (data !== undefined) {
      response.data = data;
    }

    return response;
  }

  /**
   * Creates a waiting for human input response with the AgentResponse format
   * @param data - Optional data to include
   */
  static waitingForHumanInput<T = unknown>(
    data?: T
  ): { status: 'waiting_for_human_input'; data?: T } {
    const response: { status: 'waiting_for_human_input'; data?: T } = {
      status: 'waiting_for_human_input',
    };

    if (data !== undefined) {
      response.data = data;
    }

    return response;
  }
}

/**
 * Decorator for automatic error handling in controller methods
 */
export function HandleErrors(errorCode?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return ErrorHandler.handleControllerError(
        () => originalMethod.apply(this, args),
        `${target.constructor.name}.${propertyKey}`,
        errorCode
      );
    };

    return descriptor;
  };
}

/**
 * Decorator for handling operations that should preserve BadRequestException
 */
export function HandleWithBadRequestPreservation(errorMessage?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return ErrorHandler.handleWithBadRequestPreservation(
        () => originalMethod.apply(this, args),
        `${target.constructor.name}.${propertyKey}`,
        errorMessage
      );
    };

    return descriptor;
  };
}

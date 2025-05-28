import { logger } from '@snakagent/core';
import { ERROR_MESSAGES } from '../constants/healthcare.js';

export interface HelmaiError {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface HelmaiSuccess<T = unknown> {
  status: 'success';
  data: T;
  timestamp: string;
}

export type HelmaiResult<T = unknown> = HelmaiSuccess<T> | HelmaiError;

export class HelmaiErrorHandler {
  static createError(
    code: string,
    message: string,
    details?: unknown
  ): HelmaiError {
    const error: HelmaiError = {
      status: 'error',
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    logger.error('HelmAI Error:', {
      code,
      message,
      details,
    });

    return error;
  }

  static createSuccess<T>(data: T): HelmaiSuccess<T> {
    return {
      status: 'success',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  static handleApiError(error: unknown, context: string): HelmaiError {
    if (error instanceof Error) {
      logger.error(`API Error in ${context}:`, {
        message: error.message,
        stack: error.stack,
      });

      // Handle specific error types
      if (error.message.includes('timeout')) {
        return this.createError('TIMEOUT_ERROR', ERROR_MESSAGES.TIMEOUT_ERROR, {
          context,
          originalError: error.message,
        });
      }

      if (
        error.message.includes('network') ||
        error.message.includes('ECONNREFUSED')
      ) {
        return this.createError('NETWORK_ERROR', ERROR_MESSAGES.NETWORK_ERROR, {
          context,
          originalError: error.message,
        });
      }

      if (
        error.message.includes('401') ||
        error.message.includes('unauthorized')
      ) {
        return this.createError(
          'UNAUTHORIZED',
          ERROR_MESSAGES.BACKEND_UNAUTHORIZED,
          { context, originalError: error.message }
        );
      }

      return this.createError('API_ERROR', error.message, {
        context,
        originalError: error.message,
      });
    }

    logger.error(`Unknown error in ${context}:`, error);
    return this.createError('INTERNAL_ERROR', ERROR_MESSAGES.INTERNAL_ERROR, {
      context,
      originalError: String(error),
    });
  }

  static handleValidationError(error: unknown, context: string): HelmaiError {
    logger.error(`Validation error in ${context}:`, error);

    if (error instanceof Error) {
      return this.createError('VALIDATION_ERROR', error.message, {
        context,
        type: 'validation',
      });
    }

    return this.createError(
      'VALIDATION_ERROR',
      ERROR_MESSAGES.VALIDATION_ERROR,
      { context, originalError: String(error) }
    );
  }

  static handleWhatsAppError(error: unknown, context: string): HelmaiError {
    logger.error(`WhatsApp error in ${context}:`, error);

    if (error instanceof Error) {
      if (error.message.includes('phone number')) {
        return this.createError(
          'INVALID_PHONE_NUMBER',
          ERROR_MESSAGES.INVALID_PHONE_NUMBER,
          { context, originalError: error.message }
        );
      }

      return this.createError(
        'WHATSAPP_ERROR',
        ERROR_MESSAGES.WHATSAPP_API_ERROR,
        { context, originalError: error.message }
      );
    }

    return this.createError(
      'WHATSAPP_ERROR',
      ERROR_MESSAGES.WHATSAPP_API_ERROR,
      { context, originalError: String(error) }
    );
  }

  static handlePatientError(error: unknown, context: string): HelmaiError {
    logger.error(`Patient error in ${context}:`, error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return this.createError(
          'PATIENT_NOT_FOUND',
          ERROR_MESSAGES.PATIENT_NOT_FOUND,
          { context }
        );
      }

      if (error.message.includes('already exists')) {
        return this.createError(
          'PATIENT_EXISTS',
          ERROR_MESSAGES.PATIENT_ALREADY_EXISTS,
          { context }
        );
      }

      return this.createError(
        'PATIENT_ERROR',
        ERROR_MESSAGES.INVALID_PATIENT_DATA,
        { context, originalError: error.message }
      );
    }

    return this.createError(
      'PATIENT_ERROR',
      ERROR_MESSAGES.INVALID_PATIENT_DATA,
      { context, originalError: String(error) }
    );
  }

  static handleTaskError(error: unknown, context: string): HelmaiError {
    logger.error(`Task error in ${context}:`, error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return this.createError(
          'TASK_NOT_FOUND',
          ERROR_MESSAGES.TASK_NOT_FOUND,
          { context }
        );
      }

      if (error.message.includes('already completed')) {
        return this.createError(
          'TASK_COMPLETED',
          ERROR_MESSAGES.TASK_ALREADY_COMPLETED,
          { context }
        );
      }

      return this.createError('TASK_ERROR', ERROR_MESSAGES.INVALID_TASK_DATA, {
        context,
        originalError: error.message,
      });
    }

    return this.createError('TASK_ERROR', ERROR_MESSAGES.INVALID_TASK_DATA, {
      context,
      originalError: String(error),
    });
  }

  static handleChatError(error: unknown, context: string): HelmaiError {
    logger.error(`Chat error in ${context}:`, error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return this.createError(
          'CHAT_NOT_FOUND',
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          { context }
        );
      }

      if (error.message.includes('already closed')) {
        return this.createError(
          'CHAT_CLOSED',
          ERROR_MESSAGES.CHAT_ALREADY_CLOSED,
          { context }
        );
      }

      return this.createError('CHAT_ERROR', ERROR_MESSAGES.INVALID_CHAT_DATA, {
        context,
        originalError: error.message,
      });
    }

    return this.createError('CHAT_ERROR', ERROR_MESSAGES.INVALID_CHAT_DATA, {
      context,
      originalError: String(error),
    });
  }

  static toJsonString(result: HelmaiResult): string {
    return JSON.stringify(result);
  }
}

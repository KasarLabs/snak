import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { BaseError } from '../errors/base.error';
import { ConfigurationService } from '../../config/configuration';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly config: ConfigurationService) {}

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    this.logger.error('Exception caught:', {
      name: exception.name,
      message: exception.message,
      stack: exception.stack,
    });

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return response.status(status).send({
        statusCode: status,
        message: exception.message,
        error: exception.name,
      });
    }

    if (exception instanceof BaseError) {
      const errorResponse = exception.toJSON();
      return response.status(HttpStatus.BAD_REQUEST).send({
        ...errorResponse,
        statusCode: HttpStatus.BAD_REQUEST,
      });
    }

    // Default error response for unhandled errors
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: this.config.isDevelopment
        ? exception.message
        : 'Internal server error',
      error: exception.name,
    });
  }
}

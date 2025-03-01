import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';

import { FastifyRequest, FastifyReply } from 'fastify';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: HttpException, host: ArgumentsHost) {
    this.logger.log('Exception catched in HttpExceptionFilter', exception);
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const statusCode = exception.getStatus();

    response.status(statusCode);
    if (typeof exception.getResponse() === 'string') {
      response.send({
        statusCode,
        error: exception.getResponse(),
        path: request.url,
        serverError: true,
      });
    } else {
      response.send(exception.getResponse());
    }
  }
}

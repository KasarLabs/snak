import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { FastifyRequest, FastifyReply } from 'fastify';
import { INTERNAL_SERVER_ERROR } from '../interceptors/constant';

@Catch()
export class allLeftOverExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(allLeftOverExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    this.logger.log('Excepetion catched in allLeftOverException');
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.log({ exception });
    const message =
      exception instanceof Error ? exception?.message : INTERNAL_SERVER_ERROR;
    console.log({ message });

    response.status(status).send({
      status,
      message: message,
      path: request.url,
    });
  }
}

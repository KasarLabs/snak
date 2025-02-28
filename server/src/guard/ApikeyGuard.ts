import { FastifyRequest } from 'fastify';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigurationService } from '../../config/configuration';
import { UnauthorizedError } from '../../common/errors';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigurationService) {}

  canActivate(
    context: ExecutionContext
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedError('API key is missing');
    }

    if (apiKey != this.config.apiKey) {
      throw new UnauthorizedError('API key is not valid');
    }

    return true;
  }
}

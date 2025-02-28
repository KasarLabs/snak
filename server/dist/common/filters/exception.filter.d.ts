import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ConfigurationService } from '../../config/configuration';
export declare class GlobalExceptionFilter implements ExceptionFilter {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigurationService);
    catch(exception: Error, host: ArgumentsHost): FastifyReply<import("fastify").RouteGenericInterface, import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, unknown, import("fastify").FastifySchema, import("fastify").FastifyTypeProviderDefault, unknown>;
}

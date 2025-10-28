// CRITICAL: reflect-metadata must be imported first for class-transformer decorators
import 'reflect-metadata';

// CRITICAL: Initialize Guards BEFORE any other imports that might use getGuardValue
import './init-guards.js';

// Global handler: Prevent Google Gemini stream errors from killing the process
// These errors will still propagate to try-catch blocks, but won't crash the app
process.on('unhandledRejection', (reason: any) => {
  const errorString = String(reason);
  const errorMessage = reason?.message || '';

  // Detect any Gemini/GoogleGenerativeAI errors
  const isGeminiError =
    reason?.name === 'GoogleGenerativeAIError' ||
    reason?.constructor?.name === 'GoogleGenerativeAIError' ||
    errorString.includes('GoogleGenerativeAI') ||
    errorMessage.includes('Failed to parse stream') ||
    errorMessage.includes('API error:') ||
    errorMessage.includes('generativeai.google') ||
    (reason?.status === 'INTERNAL' && reason?.errorDetails) ||
    (reason?.code === 500 && reason?.status);

  if (isGeminiError) {
    console.error('[Gemini Error - Prevented Crash]', {
      name: reason?.name,
      message: errorMessage,
      status: reason?.status,
      code: reason?.code,
      stack: reason?.stack?.split('\n').slice(0, 3).join('\n'),
    });
    // Don't throw - just log and continue
    // The error has already been handled by the graph's error handlers
    return;
  }
  // For non-Gemini errors, use default Node.js behavior
  console.error('Unhandled rejection:', reason);
  throw reason;
});

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationError as ClassValidatorError } from 'class-validator';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/exception.filter.js';
import ErrorLoggingInterceptor from './common/interceptors/error-logging.interceptor.js';
import { ConfigurationService } from './config/configuration.js';
import { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { USER_ID_HEADER } from './src/utils/headers.js';
import { getGuardValue } from '@snakagent/core';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter()
    );

    await (
      app.getHttpAdapter().getInstance() as unknown as FastifyInstance
    ).register(fastifyMultipart as any, {
      limits: {
        fileSize: getGuardValue('rag.max_size'), // 501KB
        files: getGuardValue('rag.min_size'),
      },
    });

    const config = app.get(ConfigurationService);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        validateCustomDecorators: true,
        exceptionFactory: (errors: ClassValidatorError[]) => {
          const validationErrors = errors.reduce<Record<string, string[]>>(
            (acc, err) => {
              if (err.constraints) {
                acc[err.property] = Object.values(err.constraints);
              }
              return acc;
            },
            {}
          );

          throw new BadRequestException({
            statusCode: 400,
            message: 'Validation failed',
            errors: validationErrors,
          });
        },
      })
    );

    app.useGlobalFilters(new GlobalExceptionFilter(config));
    app.useGlobalInterceptors(new ErrorLoggingInterceptor());

    app.use(helmet({ crossOriginResourcePolicy: false }));
    app.setGlobalPrefix('/api');

    app.enableCors({
      origin: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-api-key',
        USER_ID_HEADER,
      ],
    });

    await app.listen(config.port, '0.0.0.0');

    logger.log(`Application is running on: ${await app.getUrl()}`);
    logger.log(`Environment: ${config.nodeEnv}`);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

bootstrap();

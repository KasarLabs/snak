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
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
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
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1,
      },
    });

    const config = app.get(ConfigurationService);
    const port = {
      basePort: 4000, // Port de départ
      maxPortAttempts: 100, // Nombre maximum de tentatives
      path: '../../common/server_port.txt',
    };

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

    const isPortAvailable = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const server = net.createServer();

        server.once('error', () => {
          resolve(false);
        });

        server.once('listening', () => {
          server.close();
          resolve(true);
        });

        server.listen(port, '0.0.0.0');
      });
    };

    // Trouver un port disponible
    const findAvailablePort = async (
      startPort: number,
      maxAttempts: number
    ): Promise<number> => {
      let port = startPort;
      let attempts = 0;

      while (attempts < maxAttempts) {
        if (await isPortAvailable(port)) {
          return port;
        }
        port++;
        attempts++;
      }

      throw new Error(
        `Impossible de trouver un port disponible après ${maxAttempts} tentatives`
      );
    };

    app.useGlobalFilters(new GlobalExceptionFilter(config));
    app.useGlobalInterceptors(new ErrorLoggingInterceptor());

    app.use(helmet({ crossOriginResourcePolicy: false }));
    app.setGlobalPrefix('/api');

    app.enableCors({
      origin: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    });

    const availablePort = await findAvailablePort(
      port.basePort,
      port.maxPortAttempts
    );
    await app.listen(availablePort, '0.0.0.0');

    const portFilePath = path.resolve(port.path);
    const portFileDir = path.dirname(portFilePath);

    if (!fs.existsSync(portFileDir)) {
      logger.warn(`Directory ${portFileDir} does not exist. Creating it...`);
      fs.mkdirSync(portFileDir, { recursive: true });
    }
    fs.writeFileSync(portFilePath, availablePort.toString(), {
      encoding: 'utf8',
    });

    logger.log(`Application is running on: ${await app.getUrl()}`);
    logger.log(`Environment: ${config.nodeEnv}`);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

bootstrap();

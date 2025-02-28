"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const helmet_1 = __importDefault(require("helmet"));
const exception_filter_1 = require("./common/filters/exception.filter");
const error_logging_interceptor_1 = __importDefault(require("./common/interceptors/error-logging.interceptor"));
const configuration_1 = require("./config/configuration");
const multipart_1 = __importDefault(require("@fastify/multipart"));
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    try {
        const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter());
        await app.getHttpAdapter().getInstance().register(multipart_1.default, {
            limits: {
                fileSize: 10 * 1024 * 1024,
                files: 1,
            },
        });
        const config = app.get(configuration_1.ConfigurationService);
        app.useGlobalPipes(new common_1.ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            validateCustomDecorators: true,
            exceptionFactory: (errors) => {
                const validationErrors = errors.reduce((acc, err) => {
                    if (err.constraints) {
                        acc[err.property] = Object.values(err.constraints);
                    }
                    return acc;
                }, {});
                throw new common_1.BadRequestException({
                    statusCode: 400,
                    message: 'Validation failed',
                    errors: validationErrors,
                });
            },
        }));
        app.useGlobalFilters(new exception_filter_1.GlobalExceptionFilter(config));
        app.useGlobalInterceptors(new error_logging_interceptor_1.default());
        app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
        app.setGlobalPrefix('/api');
        app.enableCors({
            origin: true,
            methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
        });
        await app.listen(config.port, '0.0.0.0');
        logger.log(`Application is running on: ${await app.getUrl()}`);
        logger.log(`Environment: ${config.nodeEnv}`);
    }
    catch (error) {
        logger.error('Failed to start application', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map
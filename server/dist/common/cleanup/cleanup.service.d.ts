import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export declare class CleanupService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private uploadDir;
    private readonly maxAge;
    handleHourlyCleanup(): Promise<void>;
    onModuleInit(): void;
    onModuleDestroy(): void;
}

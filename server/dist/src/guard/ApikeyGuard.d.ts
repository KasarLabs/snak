import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigurationService } from '../../config/configuration';
export declare class ApiKeyGuard implements CanActivate {
    private readonly config;
    constructor(config: ConfigurationService);
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean>;
}

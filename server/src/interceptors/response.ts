import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class AgentResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const url = request.url;

    if (url === '/api/wallet/request') {
      return next.handle();
    }
    return next.handle().pipe(
      map((data) => {
        const request = context.switchToHttp().getRequest().body?.request || '';

        let responseText: string;
        if (data?.data?.output) {
          return data.data;
        }

        try {
          if (typeof data === 'string') {
            const lastBraceIndex = data.lastIndexOf('}');
            if (lastBraceIndex !== -1) {
              responseText = data.substring(lastBraceIndex + 1).trim();
            } else {
              responseText = data;
            }
          } else if (data?.data) {
            responseText =
              typeof data.data === 'string'
                ? data.data
                : JSON.stringify(data.data);
          } else {
            responseText = JSON.stringify(data);
          }

          responseText = responseText.trim();

          return {
            input: request,
            output: [
              {
                index: 0,
                type: 'text',
                text: responseText,
              },
            ],
          };
        } catch (error) {
          return {
            input: request,
            output: [
              {
                index: 0,
                type: 'text',
                text: typeof data === 'string' ? data : JSON.stringify(data),
              },
            ],
          };
        }
      })
    );
  }
}

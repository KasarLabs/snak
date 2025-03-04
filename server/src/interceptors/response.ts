import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { json } from 'stream/consumers';

interface ResponseData {
  status: string;
  data: string;
}

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
          const json_response = data.output[0].text;
          const json_parser = JSON.parse(json_response);
          const typedJsonObject: ResponseData = json_parser;
          if (!data.output[0].text) {
            throw new Error('No text response');
          }
          return {
            input: request,
            output: [
              {
                index: 0,
                type: 'text',
                status: typedJsonObject.status,
                text: typedJsonObject.data,
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

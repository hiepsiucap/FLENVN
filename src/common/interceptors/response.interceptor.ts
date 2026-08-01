import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

function isApiResponse(value: unknown): value is Partial<ApiResponse<unknown>> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'data' in value
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data: T) => {
        const timestamp = new Date().toISOString();

        if (isApiResponse(data)) {
          return {
            ...data,
            timestamp: data.timestamp ?? timestamp,
          } as ApiResponse<T>;
        }

        return {
          success: true,
          data,
          timestamp,
        };
      }),
    );
  }
}

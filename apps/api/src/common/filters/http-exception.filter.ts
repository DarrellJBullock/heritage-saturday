import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorShape } from '@heritage-saturday/shared';

/**
 * Global error handler emitting the shared error shape from
 * company-docs/architecture.md §8: { statusCode, error, message, detail? }.
 * Domain error codes travel in `error`; frontend switches on that field, never
 * parses `message` strings.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      let shape: ApiErrorShape;
      if (typeof body === 'object' && body !== null && 'error' in (body as Record<string, unknown>)) {
        shape = body as unknown as ApiErrorShape;
      } else {
        shape = {
          statusCode: status,
          error: typeof body === 'string' ? body : exception.name,
          message: exception.message,
        };
      }
      response.status(status).json(shape);
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    const shape: ApiErrorShape = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(shape);
  }
}

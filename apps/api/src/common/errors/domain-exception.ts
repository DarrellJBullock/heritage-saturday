import { HttpException } from '@nestjs/common';
import { ApiErrorShape, DomainErrorCode } from '@heritage-saturday/shared';

/**
 * Throws with the shared { statusCode, error, message, detail? } shape from
 * company-docs/architecture.md §8, so AllExceptionsFilter can pass it through untouched.
 */
export class DomainException extends HttpException {
  constructor(statusCode: number, error: DomainErrorCode | string, message: string, detail?: Record<string, unknown>) {
    const shape: ApiErrorShape = { statusCode, error, message, detail };
    super(shape, statusCode);
  }
}

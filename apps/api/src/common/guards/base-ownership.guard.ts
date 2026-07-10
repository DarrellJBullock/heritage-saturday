import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DomainException } from '../errors/domain-exception';
import { PrismaService } from '../prisma/prisma.service';

/**
 * OwnershipGuard base per company-docs/architecture.md §8: resolves the true
 * owning userId for the requested resource server-side and 404s (never 403,
 * to avoid leaking existence) on mismatch. Subclasses supply `paramName` (the
 * route param carrying the resource id) and `resolveOwnerId` (a small lookup).
 *
 * If the route has no matching param (e.g. a list endpoint), this guard is a
 * no-op — those endpoints are expected to filter `WHERE ownerId = req.user.id`
 * in the service layer directly.
 */
@Injectable()
export abstract class BaseOwnershipGuard implements CanActivate {
  protected abstract paramName: string;

  constructor(protected readonly prisma: PrismaService) {}

  protected abstract resolveOwnerId(prisma: PrismaService, resourceId: string): Promise<string | null>;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHENTICATED',
        message: 'Missing authenticated user',
      });
    }

    const resourceId = req.params[this.paramName];
    if (!resourceId) {
      return true;
    }

    const ownerId = await this.resolveOwnerId(this.prisma, resourceId);
    if (!ownerId || ownerId !== userId) {
      throw new DomainException(404, 'NOT_FOUND', 'Resource not found');
    }

    return true;
  }
}

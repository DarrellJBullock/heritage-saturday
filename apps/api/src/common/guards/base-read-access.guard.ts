import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DomainException } from '../errors/domain-exception';
import { PrismaService } from '../prisma/prisma.service';

export interface ReadAccessDescriptor {
  /** The resource's owner. Null means the resource does not exist. */
  ownerId: string | null;
  /** The league the resource belongs to (for the membership check). */
  leagueId: string | null;
  /** Whether this resource is visible to league members (a LEAGUE-visible roster, or the
   *  league shell itself). PRIVATE rosters are not member-visible. */
  memberVisible: boolean;
}

/** True iff `userId` has an accepted membership row for `leagueId`. Shared with services that
 *  must make the same check outside a route guard (e.g. TeamsService.listForRoster). */
export async function isLeagueMember(
  prisma: PrismaService,
  leagueId: string,
  userId: string,
): Promise<boolean> {
  const row = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  return row !== null;
}

/**
 * Read-access counterpart to BaseOwnershipGuard (apps/api/src/common/guards/base-ownership.guard.ts).
 * Grants a GET iff the caller owns the resource, OR the resource is member-visible and the caller
 * is a member of its league. Every other case 404s — never 403, same non-disclosure rule as the
 * ownership guard. Write routes keep the owner-only guards; this is only for reads.
 */
@Injectable()
export abstract class BaseReadAccessGuard implements CanActivate {
  protected abstract paramName: string;

  constructor(protected readonly prisma: PrismaService) {}

  protected abstract resolve(
    prisma: PrismaService,
    resourceId: string,
  ): Promise<ReadAccessDescriptor | null>;

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

    const desc = await this.resolve(this.prisma, resourceId);
    if (!desc || !desc.ownerId) {
      throw new DomainException(404, 'NOT_FOUND', 'Resource not found');
    }
    if (desc.ownerId === userId) {
      return true;
    }
    if (
      desc.memberVisible &&
      desc.leagueId &&
      (await isLeagueMember(this.prisma, desc.leagueId, userId))
    ) {
      return true;
    }
    throw new DomainException(404, 'NOT_FOUND', 'Resource not found');
  }
}

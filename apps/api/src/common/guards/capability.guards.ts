import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Capability, hasCapability } from '@heritage-saturday/shared';
import { DomainException } from '../errors/domain-exception';
import { PrismaService } from '../prisma/prisma.service';
import { resolveLeagueRole } from './base-read-access.guard';

// Tag a mutation route with the capability it requires; the capability guard reads it.
export const CAPABILITY_KEY = 'league_capability';
export const RequireCapability = (capability: Capability) => SetMetadata(CAPABILITY_KEY, capability);

/**
 * Gates a mutation by the caller's league role. Resolves the league (per subclass), then the
 * caller's role, then checks the route's required capability. Denial mirrors the ownership
 * model where it must (non-members must not learn a league exists) but is honest where it can:
 *   - not a member (or league missing) → 404 (non-disclosure)
 *   - a member whose role lacks the capability → 403 (they can already see the league)
 * Fails closed: a route with no @RequireCapability is rejected.
 */
abstract class BaseCapabilityGuard implements CanActivate {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly reflector: Reflector,
  ) {}

  protected abstract resolveLeagueId(prisma: PrismaService, req: Request): Promise<string | null>;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const capability = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!capability) {
      throw new DomainException(403, 'FORBIDDEN', 'No capability declared for this route');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'UNAUTHENTICATED',
        message: 'Missing authenticated user',
      });
    }

    const leagueId = await this.resolveLeagueId(this.prisma, req);
    if (!leagueId) {
      throw new DomainException(404, 'NOT_FOUND', 'Resource not found');
    }
    const role = await resolveLeagueRole(this.prisma, leagueId, userId);
    if (!role) {
      // Neither owner nor member — do not disclose that the league exists.
      throw new DomainException(404, 'NOT_FOUND', 'Resource not found');
    }
    if (!hasCapability(role, capability)) {
      throw new DomainException(403, 'FORBIDDEN', 'Your role does not permit this action');
    }
    return true;
  }
}

/** For routes that carry the league id as `leagueId`. */
@Injectable()
export class LeagueByParamCapabilityGuard extends BaseCapabilityGuard {
  // Explicit constructor so TS emits design:paramtypes on the subclass; without it Nest can't
  // see the base's two dependencies and injects neither.
  constructor(prisma: PrismaService, reflector: Reflector) {
    super(prisma, reflector);
  }

  protected async resolveLeagueId(_prisma: PrismaService, req: Request): Promise<string | null> {
    return req.params['leagueId'] ?? null;
  }
}

/** For routes addressed by a roster id (`id`); the league is resolved through the roster. */
@Injectable()
export class RosterCapabilityGuard extends BaseCapabilityGuard {
  constructor(prisma: PrismaService, reflector: Reflector) {
    super(prisma, reflector);
  }

  protected async resolveLeagueId(prisma: PrismaService, req: Request): Promise<string | null> {
    const id = req.params['id'];
    if (!id) return null;
    const roster = await prisma.roster.findUnique({ where: { id }, select: { leagueId: true } });
    return roster?.leagueId ?? null;
  }
}

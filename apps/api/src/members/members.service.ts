import { Injectable } from '@nestjs/common';
import { LeagueMemberDto } from '@heritage-saturday/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Add a user to a league by email. Idempotent; the user must already exist. Owner-only route. */
  async addByEmail(leagueId: string, email: string): Promise<LeagueMemberDto> {
    const trimmed = email?.trim();
    if (!trimmed) {
      throw new DomainException(400, 'BAD_REQUEST', 'email is required');
    }
    const user = await this.prisma.user.findUnique({ where: { email: trimmed } });
    if (!user) {
      throw new DomainException(404, 'NOT_FOUND', 'No user with that email has signed in');
    }
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { ownerId: true },
    });
    if (!league) {
      throw new DomainException(404, 'NOT_FOUND', 'League not found');
    }
    if (user.id === league.ownerId) {
      throw new DomainException(409, 'CONFLICT', 'The owner is already in the league');
    }

    await this.prisma.leagueMember.upsert({
      where: { leagueId_userId: { leagueId, userId: user.id } },
      update: {},
      create: { leagueId, userId: user.id },
    });
    return { userId: user.id, email: user.email, role: 'MEMBER' };
  }

  async remove(leagueId: string, userId: string): Promise<void> {
    await this.prisma.leagueMember.deleteMany({ where: { leagueId, userId } });
  }

  /** Owner first, then members in join order. */
  async list(leagueId: string): Promise<LeagueMemberDto[]> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        owner: { select: { id: true, email: true } },
        members: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });
    if (!league) {
      throw new DomainException(404, 'NOT_FOUND', 'League not found');
    }
    return [
      { userId: league.owner.id, email: league.owner.email, role: 'OWNER' },
      ...league.members.map((m) => ({ userId: m.user.id, email: m.user.email, role: 'MEMBER' as const })),
    ];
  }
}

import { Injectable } from '@nestjs/common';
import { LeagueMemberDto, MEMBER_ROLES, MemberRole } from '@heritage-saturday/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainException } from '../common/errors/domain-exception';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Add a user to a league by email with a role (default VIEWER). Idempotent; the user must
   * already exist. Re-adding updates the role. Route is gated by `members:manage`.
   */
  async addByEmail(leagueId: string, email: string, role?: MemberRole): Promise<LeagueMemberDto> {
    const trimmed = email?.trim();
    if (!trimmed) {
      throw new DomainException(400, 'BAD_REQUEST', 'email is required');
    }
    const assignedRole = this.validateRole(role ?? 'VIEWER');

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
      update: { role: assignedRole },
      create: { leagueId, userId: user.id, role: assignedRole },
    });
    return { userId: user.id, email: user.email, role: assignedRole };
  }

  /** Change an existing member's role. 404 if the user is not a member of the league. */
  async setRole(leagueId: string, userId: string, role: MemberRole): Promise<LeagueMemberDto> {
    const assignedRole = this.validateRole(role);
    const existing = await this.prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { user: { select: { email: true } } },
    });
    if (!existing) {
      throw new DomainException(404, 'NOT_FOUND', 'That user is not a member of this league');
    }
    await this.prisma.leagueMember.update({
      where: { leagueId_userId: { leagueId, userId } },
      data: { role: assignedRole },
    });
    return { userId, email: existing.user.email, role: assignedRole };
  }

  private validateRole(role: unknown): MemberRole {
    if (!(MEMBER_ROLES as readonly string[]).includes(role as string)) {
      throw new DomainException(400, 'BAD_REQUEST', `role must be one of ${MEMBER_ROLES.join(', ')}`);
    }
    return role as MemberRole;
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
      ...league.members.map((m) => ({ userId: m.user.id, email: m.user.email, role: m.role })),
    ];
  }
}

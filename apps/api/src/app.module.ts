import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { ApiKeyMiddleware } from './common/auth/api-key.middleware';
import { TrustedProxyUserMiddleware } from './common/auth/trusted-proxy-user.middleware';
import { AuthModule } from './auth/auth.module';
import { LeaguesModule } from './leagues/leagues.module';
import { MembersModule } from './members/members.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ImportsModule } from './imports/imports.module';
import { RostersModule } from './rosters/rosters.module';
import { TeamsModule } from './teams/teams.module';
import { PlayersModule } from './players/players.module';
import { DepthChartsModule } from './depth-charts/depth-charts.module';
import { GamesModule } from './games/games.module';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    LeaguesModule,
    MembersModule,
    InvitationsModule,
    ImportsModule,
    RostersModule,
    TeamsModule,
    PlayersModule,
    DepthChartsModule,
    GamesModule,
    ScheduleModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Order matters: reject unknown callers before trusting their x-user-id header. Every
    // route is gated, `POST /auth/session` included — that endpoint mints the identity the
    // other routes assert, so leaving it open would let anyone create or hijack an account.
    consumer.apply(ApiKeyMiddleware).forRoutes('*');

    // ...but /auth/session is what *establishes* the user id, so it cannot already carry one.
    consumer
      .apply(TrustedProxyUserMiddleware)
      .exclude({ path: 'auth/session', method: RequestMethod.POST })
      .forRoutes('*');
  }
}

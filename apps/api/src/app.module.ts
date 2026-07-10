import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthStubMiddleware } from './common/auth/auth-stub.middleware';
import { ImportsModule } from './imports/imports.module';
import { RostersModule } from './rosters/rosters.module';
import { TeamsModule } from './teams/teams.module';
import { PlayersModule } from './players/players.module';
import { DepthChartsModule } from './depth-charts/depth-charts.module';
import { GamesModule } from './games/games.module';

@Module({
  imports: [
    PrismaModule,
    ImportsModule,
    RostersModule,
    TeamsModule,
    PlayersModule,
    DepthChartsModule,
    GamesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthStubMiddleware).forRoutes('*');
  }
}

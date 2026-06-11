import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { GameController } from '../controllers/game.controller';
import { GameService } from '../services/game.service';
import { GAME_REPOSITORY } from '../repositories/game.repository';
import { PrismaGameRepository } from '../repositories/prisma-game.repository';

@Module({
  imports: [AuthModule],
  controllers: [GameController],
  providers: [
    GameService,
    {
      provide: GAME_REPOSITORY,
      useClass: PrismaGameRepository,
    },
  ],
})
export class GameModule {}

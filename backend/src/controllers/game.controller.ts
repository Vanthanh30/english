import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GameService } from '../services/game.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { GameQueryDto, SubmitScoreDto } from './dto/game/game.dto';

@Controller('game')
@UseGuards(JwtAuthGuard)
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('vocabularies')
  getVocabularies(
    @Query() query: GameQueryDto,
  ) {
    return this.gameService.getVocabulariesForGame(query.topicId, query.difficulty);
  }

  @Post('scores')
  submitScore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SubmitScoreDto,
  ) {
    return this.gameService.submitScore(user.id, body);
  }

  @Get('leaderboard')
  getLeaderboard(
    @Query() query: GameQueryDto,
  ) {
    return this.gameService.getLeaderboard(query.topicId, query.difficulty);
  }
}

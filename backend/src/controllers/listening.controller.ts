import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { MongoIdPipe } from '../middlewares/validation.middleware';
import { ListeningService } from '../services/listening.service';
import { UpdateProgressDto } from './dto/listening/listening.dto';
import { ContentLevel } from '@prisma/client';

@Controller('listening-topics')
@UseGuards(JwtAuthGuard)
export class ListeningController {
  constructor(private readonly listeningService: ListeningService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('level') level?: ContentLevel,
    @Query('search') search?: string,
  ) {
    return this.listeningService.listTopics({ level, search, userId: user.id });
  }

  @Get(':idOrSlug')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('idOrSlug') idOrSlug: string,
  ) {
    return this.listeningService.getTopic(idOrSlug, user.id);
  }

  @Post(':id/progress')
  updateProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() body: UpdateProgressDto,
  ) {
    return this.listeningService.updateProgress(user.id, id, body);
  }
}

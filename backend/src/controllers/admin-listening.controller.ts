import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import { RolesGuard } from '../middlewares/admin.middleware';
import { Roles } from '../middlewares/decorators/roles.decorator';
import { MongoIdPipe } from '../middlewares/validation.middleware';
import { ListeningService } from '../services/listening.service';
import {
  CreateListeningTopicDto,
  UpdateListeningTopicDto,
  AutoTranscribeDto,
} from './dto/listening/listening.dto';
import { ContentLevel } from '@prisma/client';

@Controller('admin/listening-topics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminListeningController {
  constructor(private readonly listeningService: ListeningService) {}

  @Get()
  list(
    @Query('level') level?: ContentLevel,
    @Query('search') search?: string,
  ) {
    return this.listeningService.listTopics({ level, search });
  }

  @Get(':id')
  get(@Param('id', MongoIdPipe) id: string) {
    return this.listeningService.getTopic(id);
  }

  @Post()
  create(@Body() body: CreateListeningTopicDto) {
    return this.listeningService.createTopic(body);
  }

  @Put(':id')
  update(
    @Param('id', MongoIdPipe) id: string,
    @Body() body: UpdateListeningTopicDto,
  ) {
    return this.listeningService.updateTopic(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id', MongoIdPipe) id: string) {
    return this.listeningService.deleteTopic(id);
  }

  @Post('auto-transcribe')
  autoTranscribe(@Body() body: AutoTranscribeDto) {
    return this.listeningService.autoTranscribe(body);
  }
}

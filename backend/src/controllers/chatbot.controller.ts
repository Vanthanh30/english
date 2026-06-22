import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatbotService } from '../services/chatbot.service';
import { JwtAuthGuard } from '../middlewares/auth.middleware';
import type { AuthenticatedUser } from '../middlewares/auth.middleware';
import { CurrentUser } from '../middlewares/decorators/current-user.decorator';
import { MongoIdPipe } from '../middlewares/validation.middleware';
import { CreateSessionDto, SendMessageDto } from './dto/chatbot/chatbot.dto';

@Controller('chatbot')
@UseGuards(JwtAuthGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Get('sessions')
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.chatbotService.listSessions(user.id);
  }

  @Post('sessions')
  createSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateSessionDto,
  ) {
    return this.chatbotService.createSession(user.id, input.title);
  }

  @Get('sessions/:id')
  getSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.chatbotService.getSession(user.id, id);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.chatbotService.deleteSession(user.id, id);
  }

  @Get('sessions/:id/messages')
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
  ) {
    return this.chatbotService.listMessages(user.id, id);
  }

  @Post('sessions/:id/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @Body() input: SendMessageDto,
  ) {
    return this.chatbotService.sendMessage(user.id, id, input.message);
  }

  @Post('sessions/:id/messages/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20_000_000 } }))
  uploadAndGrade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', MongoIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.chatbotService.sendAndGradeFile(user.id, id, file);
  }
}

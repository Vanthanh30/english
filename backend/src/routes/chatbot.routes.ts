import { Module } from '@nestjs/common';
import { AuthModule } from './auth.routes';
import { ChatbotController } from '../controllers/chatbot.controller';
import { ChatbotService } from '../services/chatbot.service';
import { CHATBOT_REPOSITORY } from '../repositories/chatbot.repository';
import { PrismaChatbotRepository } from '../repositories/prisma-chatbot.repository';

@Module({
  imports: [AuthModule],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    {
      provide: CHATBOT_REPOSITORY,
      useClass: PrismaChatbotRepository,
    },
  ],
})
export class ChatbotModule {}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../configs/db';
import type { ChatbotRepository } from './chatbot.repository';
import type { ChatSessionModel, ChatMessageModel } from '../models/chatbot.model';

@Injectable()
export class PrismaChatbotRepository implements ChatbotRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listSessions(userId: string): Promise<ChatSessionModel[]> {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findSessionById(userId: string, sessionId: string): Promise<ChatSessionModel | null> {
    return this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
  }

  async createSession(userId: string, title: string): Promise<ChatSessionModel> {
    return this.prisma.chatSession.create({
      data: { userId, title },
    });
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.chatSession.delete({
      where: { id: sessionId, userId },
    });
  }

  async listMessages(sessionId: string): Promise<ChatMessageModel[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role as 'user' | 'model',
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  async createMessage(
    sessionId: string,
    role: 'user' | 'model',
    content: string,
  ): Promise<ChatMessageModel> {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: { sessionId, role, content },
      });
      await tx.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
      return {
        id: message.id,
        sessionId: message.sessionId,
        role: message.role as 'user' | 'model',
        content: message.content,
        createdAt: message.createdAt,
      };
    });
  }
}

import type { ChatSessionModel, ChatMessageModel } from '../models/chatbot.model';

export const CHATBOT_REPOSITORY = Symbol('CHATBOT_REPOSITORY');

export interface ChatbotRepository {
  listSessions(userId: string): Promise<ChatSessionModel[]>;
  findSessionById(userId: string, sessionId: string): Promise<ChatSessionModel | null>;
  createSession(userId: string, title: string): Promise<ChatSessionModel>;
  deleteSession(userId: string, sessionId: string): Promise<void>;
  listMessages(sessionId: string): Promise<ChatMessageModel[]>;
  createMessage(sessionId: string, role: 'user' | 'model', content: string): Promise<ChatMessageModel>;
}

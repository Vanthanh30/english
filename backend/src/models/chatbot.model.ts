export interface ChatSessionModel {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageModel {
  id: string;
  sessionId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: Date;
}

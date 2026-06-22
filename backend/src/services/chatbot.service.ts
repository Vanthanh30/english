import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { CHATBOT_REPOSITORY } from '../repositories/chatbot.repository';
import type { ChatbotRepository } from '../repositories/chatbot.repository';
import type { ChatMessageModel } from '../models/chatbot.model';

@Injectable()
export class ChatbotService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly systemInstruction = `You are a friendly and educational AI English Tutor for the English Quest learning platform. 
Your goal is to help the user learn and practice English. 
Provide helpful, clear, and educational responses. 
Always analyze the user's message. If their message contains any grammar, vocabulary, or spelling mistakes, politely point it out, explain why it is incorrect, and suggest a correct or more natural phrasing in a encouraging, supportive tone.
Explain grammar rules, collocations, common idioms, or vocabulary usage if asked.
You can respond in Vietnamese to explain English concepts when the user asks or appears to struggle, but keep the learning content focused on English.
Keep your responses safe, encouraging, educational, and relatively concise.`;

  constructor(
    @Inject(CHATBOT_REPOSITORY)
    private readonly chatbotRepository: ChatbotRepository,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async listSessions(userId: string) {
    return this.chatbotRepository.listSessions(userId);
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.chatbotRepository.findSessionById(userId, sessionId);
    if (!session) {
      throw new NotFoundException('Chat session not found');
    }
    return session;
  }

  async createSession(userId: string, title: string) {
    return this.chatbotRepository.createSession(userId, title);
  }

  async deleteSession(userId: string, sessionId: string) {
    await this.getSession(userId, sessionId); // Validate owner
    await this.chatbotRepository.deleteSession(userId, sessionId);
  }

  async listMessages(userId: string, sessionId: string) {
    await this.getSession(userId, sessionId); // Validate owner
    return this.chatbotRepository.listMessages(sessionId);
  }

  async sendMessage(userId: string, sessionId: string, messageContent: string) {
    await this.getSession(userId, sessionId); // Validate owner

    // 1. Save user's message to DB
    await this.chatbotRepository.createMessage(sessionId, 'user', messageContent);

    // 2. Get full chat history (which now includes the user's new message)
    const history = await this.chatbotRepository.listMessages(sessionId);

    // 3. Call Gemini API
    const aiResponseContent = await this.callGemini(history);

    // 4. Save AI's response to DB
    const savedAiMessage = await this.chatbotRepository.createMessage(
      sessionId,
      'model',
      aiResponseContent,
    );

    return savedAiMessage;
  }

  async sendAndGradeFile(
    userId: string,
    sessionId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string },
  ) {
    await this.getSession(userId, sessionId); // Validate owner

    let content = '';
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'pdf' || file.mimetype === 'application/pdf') {
      try {
        const data = await ((pdfParse as any).default || (pdfParse as any))(file.buffer);
        content = data.text;
      } catch (err) {
        throw new BadRequestException('Failed to parse PDF text layer');
      }
    } else if (
      ext === 'docx' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        content = result.value;
      } catch (err) {
        throw new BadRequestException('Failed to parse Word document');
      }
    } else if (ext === 'txt' || file.mimetype === 'text/plain') {
      content = file.buffer.toString('utf-8');
    } else {
      throw new BadRequestException('Unsupported file format. Only PDF, DOCX, and TXT are supported.');
    }

    if (!content.trim()) {
      throw new BadRequestException('Extracted content from file is empty');
    }

    // Formulate a grading request prompt
    const promptMessage = `User has uploaded their exercises/answers file for grading: "${file.originalname}".
Here is the text extracted from the file:
---
${content}
---
Please grade the user's exercises/answers in detail. Correct any errors, assign a grade out of 10, provide explanations for any incorrect answers, and give encouraging feedback.`;

    // Save display reference in database
    const displayMessage = `[Uploaded File: ${file.originalname} for grading]`;
    await this.chatbotRepository.createMessage(sessionId, 'user', displayMessage);

    // Fetch message history containing the uploaded tag
    const history = await this.chatbotRepository.listMessages(sessionId);

    // Substitute the display tag with the full file content prompt for Gemini call
    const historyWithFilePrompt = [...history];
    if (historyWithFilePrompt.length > 0) {
      historyWithFilePrompt[historyWithFilePrompt.length - 1] = {
        ...historyWithFilePrompt[historyWithFilePrompt.length - 1],
        content: promptMessage,
      };
    }

    // Call Gemini API
    const aiResponseContent = await this.callGemini(historyWithFilePrompt);

    // Save AI's response to DB
    const savedAiMessage = await this.chatbotRepository.createMessage(
      sessionId,
      'model',
      aiResponseContent,
    );

    return savedAiMessage;
  }

  private async callGemini(history: ChatMessageModel[]): Promise<string> {
    try {
      // Get the model
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: this.systemInstruction,
      });

      // Format history for Gemini chat API.
      // Gemini expects format: { role: 'user' | 'model', parts: [{ text: string }] }
      // We will exclude the last message because we will pass it to sendMessage.
      const chatHistory = history.slice(0, -1).map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const lastMessage = history[history.length - 1];

      // Start chat with history
      const chat = model.startChat({
        history: chatHistory,
      });

      // Send the last message
      const result = await chat.sendMessage(lastMessage.content);
      const response = await result.response;
      return response.text();
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      throw new Error(`AI processing failed: ${error.message || error}`);
    }
  }
}

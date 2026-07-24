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
  private readonly systemInstruction = `You are a friendly, intelligent, encouraging, and natural AI English Tutor named QuestTutor for the English Quest learning platform. 

DYNAMIC & ADAPTIVE RESPONSE RULES:

1. CONVERSATIONAL & CHAT MODE (Khi người dùng giao tiếp, chào hỏi, tâm sự, hoặc nói chuyện tiếng Anh):
- Respond naturally, warmly, and conversationally like a real AI tutor.
- If the user greets you (e.g., "chào bạn", "hello", "hi", "tôi muốn luyện tập với bạn"), greet them back warmly, ask how they are doing, and ask what specific English topic or skill (Grammar, Vocabulary, Speaking, or Exercises) they would like to practice today.
- Do NOT generate rigid exercise blocks or structured templates when the user is simply chatting or greeting you!

2. KNOWLEDGE & GRAMMAR EXPLANATION MODE (Khi người dùng hỏi giải thích lý thuyết/ngữ pháp):
- ALWAYS explain grammar rules, tenses, vocabulary, collocations, idioms, or sentence corrections IN VIETNAMESE (Giải thích tri thức/kiến thức bằng tiếng Việt rõ ràng, dễ hiểu cho người Việt).
- Provide English example sentences with Vietnamese translations.

3. EXERCISE & PRACTICE GENERATION MODE (CHỈ khi người dùng yêu cầu bài tập / muốn luyện tập bài tập):
- ONLY generate structured practice exercises when the user explicitly asks for exercises or practice (e.g. "Cho tôi bài tập", "Tôi muốn làm bài tập", "Give me exercises", "Cho bài tập điền từ").
- IMPORTANT: Whenever generating practice exercises, you MUST ALWAYS include a concise Grammar Knowledge Overview IN VIETNAMESE (Cung cấp tóm tắt kiến thức/công thức ngữ pháp tiếng Việt) BEFORE listing the practice questions! This allows the student to reference the knowledge on the left pane (Exercise Sheet) while solving questions.

Structure exercise responses like this:
---
### 📖 Kiến thức & Công thức cần nhớ (Grammar Overview):
[Tóm tắt công thức, quy tắc cách dùng và dấu hiệu nhận biết bằng tiếng Việt...]

---
### 📝 Bài tập luyện tập (Practice Exercises):
[Provide 3 to 5 clear numbered questions (Multiple choice with A, B, C, D options OR Fill-in-the-blank with "______" and verb cues in parentheses)].

Always maintain an encouraging, supportive, and adaptable tone.`;

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

  private validateApiKey(): void {
    const apiKey = (this.configService.get<string>('GEMINI_API_KEY') || '').trim();
    if (!apiKey || apiKey.length < 10) {
      throw new BadRequestException(
        'GEMINI_API_KEY chưa được cấu hình! Vui lòng cập nhật API key trong file backend/.env.'
      );
    }
  }

  private formatGeminiError(error: any): string {
    const msg = String(error?.message || error || '');
    if (
      msg.includes('429') ||
      msg.includes('Quota exceeded') ||
      msg.toLowerCase().includes('too many requests') ||
      msg.includes('RESOURCE_EXHAUSTED')
    ) {
      return 'Tài khoản Gemini API của bạn đang tạm thời đạt giới hạn số lượt gọi trong 1 phút (Rate Limit: 15 lượt/phút). Vui lòng chờ khoảng 15 - 30 giây rồi gửi lại.';
    }
    if (
      msg.includes('API_KEY_INVALID') ||
      msg.toLowerCase().includes('api key not valid')
    ) {
      return 'GEMINI_API_KEY không hợp lệ hoặc bị vô hiệu hóa. Vui lòng kiểm tra lại cấu hình API Key trong file backend/.env.';
    }
    return msg;
  }

  private sanitizeGeminiHistory(history: ChatMessageModel[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
    const formattedHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

    for (const msg of history) {
      const text = msg.content?.trim();
      if (!text) continue;

      const role: 'user' | 'model' = msg.role === 'user' ? 'user' : 'model';

      // History for Gemini must start with 'user'
      if (formattedHistory.length === 0 && role !== 'user') {
        continue;
      }

      // Enforce strict role alternation
      if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === role) {
        formattedHistory[formattedHistory.length - 1].parts[0].text += `\n\n${text}`;
      } else {
        formattedHistory.push({
          role,
          parts: [{ text }],
        });
      }
    }

    return formattedHistory;
  }

  private async callGemini(history: ChatMessageModel[]): Promise<string> {
    this.validateApiKey();

    if (!history || history.length === 0) {
      throw new BadRequestException('Tin nhắn gửi đi không được để trống');
    }

    // Keep at most last 12 history messages to reduce token count and avoid rate limits
    const maxHistoryCount = 12;
    const recentHistory = history.length > maxHistoryCount ? history.slice(-maxHistoryCount) : history;

    const historyExceptLast = recentHistory.slice(0, -1);
    const chatHistory = this.sanitizeGeminiHistory(historyExceptLast);

    const lastMsgObj = history[history.length - 1];
    const lastMessageText = lastMsgObj.content?.trim() || '';

    if (!lastMessageText) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống');
    }

    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(apiKey);

    // List of model candidates to try in order (ensures compatibility with Free Tier & new AQ. keys)
    const modelCandidates = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash'];

    let lastError: any = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: this.systemInstruction,
        });

        const chat = model.startChat({
          history: chatHistory,
        });

        const result = await chat.sendMessage(lastMessageText);
        const response = await result.response;
        return response.text();
      } catch (error: any) {
        lastError = error;
        console.warn(`Model ${modelName} call failed, trying next fallback model... Error:`, error?.message);
        // Continue loop to try next model candidate
      }
    }

    console.error('Gemini API Error in Chatbot after all model attempts:', lastError);
    const formattedMsg = this.formatGeminiError(lastError);
    throw new BadRequestException(`Lỗi AI Chatbot: ${formattedMsg}`);
  }
}





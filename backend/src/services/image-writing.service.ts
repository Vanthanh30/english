import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IMAGE_WRITING_REPOSITORY, type ImageWritingRepository } from '../repositories/image-writing.repository';
import { FLASHCARD_REPOSITORY, type FlashcardRepository } from '../repositories/flashcard.repository';
import { PrismaService } from '../configs/db';
import { CloudinaryImageService } from '../configs/cloudinary';
import type { ImageWritingSessionModel } from '../models/image-writing.model';
import { SaveWritingVocabularyDto } from '../controllers/dto/image-writing/image-writing.dto';

@Injectable()
export class ImageWritingService {
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    @Inject(IMAGE_WRITING_REPOSITORY)
    private readonly imageWritingRepository: ImageWritingRepository,
    @Inject(FLASHCARD_REPOSITORY)
    private readonly flashcardRepo: FlashcardRepository,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cloudinary: CloudinaryImageService,
  ) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private formatGeminiError(error: any): string {
    const message = String(error?.message || error || '');
    if (message.includes('limit: 0') || (message.includes('Quota exceeded') && message.includes('limit: 0'))) {
      return 'Gemini API key has zero quota allocated or is invalid format. Please get a key starting with AIzaSy... from https://aistudio.google.com/app/apikey.';
    }
    if (message.includes('429') || message.includes('Quota exceeded') || message.toLowerCase().includes('too many requests')) {
      return 'Rate limit exceeded. Please wait a few seconds and try again.';
    }
    if (message.includes('API_KEY_INVALID') || message.toLowerCase().includes('api key')) {
      return 'Invalid Gemini API key. Please check your server configuration (backend/.env).';
    }
    return message;
  }

  async listSessions(userId: string): Promise<ImageWritingSessionModel[]> {
    return this.imageWritingRepository.listSessions(userId);
  }

  async getSession(userId: string, id: string): Promise<ImageWritingSessionModel> {
    const session = await this.imageWritingRepository.findSessionById(userId, id);
    if (!session) {
      throw new NotFoundException('Image writing session not found');
    }
    return session;
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    const session = await this.getSession(userId, id);
    if (session.imagePublicId) {
      try {
        await this.cloudinary.delete(session.imagePublicId);
      } catch (err) {
        console.error('Failed to delete image from Cloudinary:', err);
      }
    }
    await this.imageWritingRepository.deleteSession(userId, id);
  }

  async submitSession(
    userId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string },
    userText: string,
  ): Promise<ImageWritingSessionModel> {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Invalid file type. Only image files are supported.');
    }

    // 1. Upload to Cloudinary
    let uploadedImage;
    try {
      uploadedImage = await this.cloudinary.upload(file.buffer);
    } catch (err: any) {
      throw new BadRequestException(`Failed to upload image: ${err.message || err}`);
    }

    // 2. Call Gemini Vision
    let evaluationData: any;
    let lastError: any = null;
    const modelCandidates = ['gemini-2.0-flash', 'gemini-flash-latest'];

    const prompt = `You are an English writing coach. The user has uploaded an image and written an English description of it.

Your task:
1. Evaluate if the description accurately matches the image content.
2. Identify and correct grammar errors in the user's description.
3. Rewrite the description as an improved, natural English paragraph.
4. Extract 5–10 relevant vocabulary words from the image scene, with Vietnamese translations and example sentences.
5. Highlight 2–4 grammar patterns used in your improved paragraph with brief explanations in English and Vietnamese translation.

CRITICAL SCORING RUBRIC (Scale 0-100):
Evaluate strictly aligned with standardized English exams like IELTS Writing Task 1/2 criteria. Do not grade leniently:
- Word Count Constraints: A minimum of 150 words is strictly required to achieve a mediocre/average score (60-70) if basic grammar is correct and basic vocabulary is used. If the user's text is shorter than 150 words, the score MUST be capped at 60 (or lower if there are errors), regardless of how perfect the grammar is. If the text is under 50 words, the score must be capped at 40.
- A high score (80-100) requires:
  1. The text must meet the minimum length requirement of 150+ words.
  2. Must use advanced/complex vocabulary and collocations (lexical resource) instead of simple, repetitive words.
  3. Must use intermediate/upper-intermediate grammar structures (e.g. passive voice, relative clauses, participle clauses) correctly.
  4. Almost zero grammar errors.
- A low score (under 60) is for writings with noticeable grammatical errors, incorrect singular/plural usage, spelling mistakes, or severely lacking description.

Return your response as a structured JSON object with the following fields:
{
  "overallScore": 85, // strict number from 0 to 100 based on the rubric above
  "accuracyFeedback": "...", // string
  "grammarFeedback": [
    {
      "error": "...", // incorrect user phrasing
      "correction": "...", // corrected phrasing
      "explanation": "..." // English explanation of the error, followed strictly by a newline character (\n) and the Vietnamese translation in parentheses starting with "Dịch nghĩa: ". Example: "Do not use singular nouns after 'a lot of'.\n(Dịch nghĩa: Không dùng danh từ số ít sau 'a lot of'.)"
    }
  ],
  "improvedParagraph": "...", // natural rewrite
  "newVocabulary": [
    {
      "word": "...",
      "partOfSpeech": "...", // noun, verb, adjective, etc.
      "vietnameseMeaning": "...",
      "exampleSentence": "..."
    }
  ],
  "grammarPatterns": [
    {
      "pattern": "...", // e.g. Present Perfect
      "explanation": "...", // English explanation, followed strictly by a newline character (\n) and the Vietnamese translation in parentheses starting with "Dịch nghĩa: ". Example: "This pattern describes states.\n(Dịch nghĩa: Cấu trúc này dùng để mô tả trạng thái.)"
      "example": "..." // Example sentence
    }
  ]
}

User's writing:
"${userText}"`;

    for (const modelName of modelCandidates) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const response = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    data: file.buffer.toString('base64'),
                    mimeType: file.mimetype,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.response.text();
        evaluationData = JSON.parse(responseText);
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
        console.warn(`Vision model ${modelName} call failed, trying fallback... Error:`, error?.message);
      }
    }

    if (lastError) {
      console.error('Gemini Vision API Error:', lastError);
      if (uploadedImage?.publicId) {
        await this.cloudinary.delete(uploadedImage.publicId).catch(() => undefined);
      }
      throw new BadRequestException(`AI evaluation failed: ${this.formatGeminiError(lastError)}`);
    }

    // 3. Save to DB
    return this.imageWritingRepository.createSession(userId, {
      imageUrl: uploadedImage.url,
      imagePublicId: uploadedImage.publicId,
      userText,
      overallScore: Number(evaluationData.overallScore || 0),
      accuracyFeedback: String(evaluationData.accuracyFeedback || ''),
      grammarFeedback: evaluationData.grammarFeedback || [],
      improvedParagraph: String(evaluationData.improvedParagraph || ''),
      newVocabulary: evaluationData.newVocabulary || [],
      grammarPatterns: evaluationData.grammarPatterns || [],
    });
  }

  async resubmitSession(userId: string, id: string, revisedText: string): Promise<ImageWritingSessionModel> {
    const session = await this.getSession(userId, id);

    // 1. Fetch image binary from Cloudinary URL
    let imageBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(session.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get('content-type') || 'image/jpeg';
    } catch (err: any) {
      throw new BadRequestException(`Failed to retrieve image from storage: ${err.message || err}`);
    }

    // 2. Call Gemini Vision with revised prompt
    let evaluationData: any;
    let lastError: any = null;
    const modelCandidates = ['gemini-2.0-flash', 'gemini-flash-latest'];

    const prompt = `You are an English writing coach. The user has uploaded an image and written a description of it. This is a revised description.
Original description: "${session.userText}"
Revised description: "${revisedText}"

Your task:
1. Evaluate if the revised description accurately matches the image content.
2. Identify and correct grammar errors in the revised description.
3. Rewrite the description as an improved, natural English paragraph.
4. Extract 5–10 relevant vocabulary words from the image scene, with Vietnamese translations and example sentences.
5. Highlight 2–4 grammar patterns used in your improved paragraph with brief explanations in English and Vietnamese translation.

CRITICAL SCORING RUBRIC (Scale 0-100):
Evaluate strictly aligned with standardized English exams like IELTS Writing Task 1/2 criteria. Do not grade leniently:
- Word Count Constraints: A minimum of 150 words is strictly required to achieve a mediocre/average score (60-70) if basic grammar is correct and basic vocabulary is used. If the user's text is shorter than 150 words, the score MUST be capped at 60 (or lower if there are errors), regardless of how perfect the grammar is. If the text is under 50 words, the score must be capped at 40.
- A high score (80-100) requires:
  1. The text must meet the minimum length requirement of 150+ words.
  2. Must use advanced/complex vocabulary and collocations (lexical resource) instead of simple, repetitive words.
  3. Must use intermediate/upper-intermediate grammar structures (e.g. passive voice, relative clauses, participle clauses) correctly.
  4. Almost zero grammar errors.
- A low score (under 60) is for writings with noticeable grammatical errors, incorrect singular/plural usage, spelling mistakes, or severely lacking description.

Return your response as a structured JSON object with the following fields:
{
  "overallScore": 90, // strict score for the revised writing (0 to 100) based on the rubric above
  "accuracyFeedback": "...",
  "grammarFeedback": [
    {
      "error": "...",
      "correction": "...",
      "explanation": "..." // English explanation of the error, followed strictly by a newline character (\n) and the Vietnamese translation in parentheses starting with "Dịch nghĩa: ". Example: "Do not use singular nouns after 'a lot of'.\n(Dịch nghĩa: Không dùng danh từ số ít sau 'a lot of'.)"
    }
  ],
  "improvedParagraph": "...",
  "newVocabulary": [
    {
      "word": "...",
      "partOfSpeech": "...",
      "vietnameseMeaning": "...",
      "exampleSentence": "..."
    }
  ],
  "grammarPatterns": [
    {
      "pattern": "...",
      "explanation": "...", // English explanation, followed strictly by a newline character (\n) and the Vietnamese translation in parentheses starting with "Dịch nghĩa: ". Example: "This pattern describes states.\n(Dịch nghĩa: Cấu trúc này dùng để mô tả trạng thái.)"
      "example": "..."
    }
  ]
}

Evaluate based on the revised text. Ensure you calculate a fair score that reflects improvements compared to the original score (${session.overallScore}).`;

    for (const modelName of modelCandidates) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const response = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    data: imageBuffer.toString('base64'),
                    mimeType: mimeType,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        const responseText = response.response.text();
        evaluationData = JSON.parse(responseText);
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
        console.warn(`Vision model ${modelName} call failed, trying fallback... Error:`, error?.message);
      }
    }

    if (lastError) {
      console.error('Gemini Vision API Error:', lastError);
      throw new BadRequestException(`AI re-evaluation failed: ${this.formatGeminiError(lastError)}`);
    }

    // 3. Update DB
    return this.imageWritingRepository.updateSessionRevision(
      userId,
      id,
      revisedText,
      Number(evaluationData.overallScore || 0),
      String(evaluationData.accuracyFeedback || ''),
      evaluationData.grammarFeedback || [],
      String(evaluationData.improvedParagraph || ''),
      evaluationData.newVocabulary || [],
      evaluationData.grammarPatterns || [],
    );
  }

  async saveWordToFlashcards(userId: string, dto: SaveWritingVocabularyDto) {
    const normalizedWord = dto.word.trim().toLowerCase();

    // 1. Find or create default Image Writing topic
    let topic = await this.prisma.topic.findFirst({
      where: { slug: 'image-writing-words' },
    });

    if (!topic) {
      topic = await this.prisma.topic.create({
        data: {
          name: 'Image Writing Vocabulary',
          slug: 'image-writing-words',
          description: 'Vocabulary learned from image description exercises.',
          level: 'BEGINNER',
          order: 110,
          isActive: true,
        },
      });
    }

    // 2. Find or create vocabulary
    let vocab = await this.prisma.vocabulary.findFirst({
      where: {
        topicId: topic.id,
        word: {
          equals: normalizedWord,
          mode: 'insensitive',
        },
      },
    });

    if (vocab) {
      vocab = await this.prisma.vocabulary.update({
        where: { id: vocab.id },
        data: {
          meaning: dto.meaning,
          meaningVi: dto.meaningVi ?? vocab.meaningVi,
          pronunciation: dto.pronunciation ?? vocab.pronunciation,
          partOfSpeech: dto.partOfSpeech ?? vocab.partOfSpeech,
          exampleSentence: dto.exampleSentence ?? vocab.exampleSentence,
        },
      });
    } else {
      vocab = await this.prisma.vocabulary.create({
        data: {
          topicId: topic.id,
          word: normalizedWord,
          meaning: dto.meaning,
          meaningVi: dto.meaningVi ?? '',
          pronunciation: dto.pronunciation ?? '',
          partOfSpeech: dto.partOfSpeech ?? 'noun',
          exampleSentence: dto.exampleSentence ?? '',
        },
      });
    }

    // 3. Save to flashcard if not already existing
    const existingFlashcard = await this.flashcardRepo.findByUserAndVocabulary(userId, vocab.id);
    if (existingFlashcard) {
      return {
        success: true,
        alreadySaved: true,
        word: normalizedWord,
        flashcardId: existingFlashcard.id,
      };
    }

    const flashcard = await this.flashcardRepo.save(userId, vocab.id);
    return {
      success: true,
      alreadySaved: false,
      word: normalizedWord,
      flashcardId: flashcard.id,
    };
  }
}

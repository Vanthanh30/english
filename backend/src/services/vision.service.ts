import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VISION_REPOSITORY, type VisionRepository } from '../repositories/vision.repository';
import { FLASHCARD_REPOSITORY, type FlashcardRepository } from '../repositories/flashcard.repository';
import { PrismaService } from '../configs/db';
import { CloudinaryImageService } from '../configs/cloudinary';
import type { VisionHistoryModel } from '../models/vision.model';

export interface SaveVisionWordInput {
  wordId: string;
  word: string;
  meaning: string;
  meaningVi?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
}

@Injectable()
export class VisionService {
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    @Inject(VISION_REPOSITORY)
    private readonly visionRepository: VisionRepository,
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
      return 'Gemini API key has zero quota allocated or is invalid format (OAuth token instead of AI Studio key). Please get a key starting with AIzaSy... from https://aistudio.google.com/app/apikey.';
    }
    if (message.includes('429') || message.includes('Quota exceeded') || message.toLowerCase().includes('too many requests')) {
      return 'Rate limit exceeded. The Gemini API free tier allows up to 20 requests per minute. Please wait a few seconds and try again.';
    }
    if (message.includes('API_KEY_INVALID') || message.toLowerCase().includes('api key')) {
      return 'Invalid Gemini API key. Please check your server configuration (backend/.env).';
    }
    return message;
  }

  async listHistory(userId: string): Promise<VisionHistoryModel[]> {
    return this.visionRepository.listHistory(userId);
  }

  async getHistoryItem(userId: string, id: string): Promise<VisionHistoryModel> {
    const item = await this.visionRepository.findHistoryById(userId, id);
    if (!item) {
      throw new NotFoundException('Vision analysis history record not found');
    }
    return item;
  }

  async deleteHistory(userId: string, id: string): Promise<void> {
    const item = await this.getHistoryItem(userId, id);
    // Delete from Cloudinary if publicId exists
    if (item.imagePublicId) {
      try {
        await this.cloudinary.delete(item.imagePublicId);
      } catch (err) {
        console.error('Failed to delete image from Cloudinary:', err);
      }
    }
    await this.visionRepository.deleteHistory(userId, id);
  }

  async analyzeImage(userId: string, file: { originalname: string; buffer: Buffer; mimetype: string }): Promise<VisionHistoryModel> {
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
    let words = [];
    let lastError: any = null;
    const modelCandidates = ['gemini-flash-latest', 'gemini-2.0-flash'];

    const prompt = `Identify the primary objects, concepts, or activities visible in the uploaded image. 
Generate a list of 5 to 8 useful English vocabulary words related to these elements. 
For each word, provide:
1. "word": The English word/phrase (be specific, clean, and lowercased where appropriate, e.g. "coffee mug" or "laptop").
2. "meaning": A clear, concise English definition.
3. "meaningVi": A Vietnamese translation.
4. "pronunciation": The IPA pronunciation (e.g., "/ˈæp.əl/").
5. "partOfSpeech": The grammatical category (noun, verb, adjective, etc. in lowercase, e.g., "noun").
6. "exampleSentence": A simple example sentence using this word.
7. "x": A number from 0 to 100 representing the relative horizontal center of the object (0 = left edge, 100 = right edge) as an integer.
8. "y": A number from 0 to 100 representing the relative vertical center of the object (0 = top edge, 100 = bottom edge) as an integer.

Output must be a valid JSON array of objects following this structure:
[
  {
    "word": "...",
    "meaning": "...",
    "meaningVi": "...",
    "pronunciation": "...",
    "partOfSpeech": "...",
    "exampleSentence": "...",
    "x": 50,
    "y": 50
  }
]`;

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
        words = JSON.parse(responseText);

        if (!Array.isArray(words)) {
          throw new Error('Gemini did not return an array');
        }
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
        console.warn(`Vision model ${modelName} call failed, trying fallback... Error:`, error?.message);
      }
    }

    if (lastError) {
      console.error('Gemini Vision API Error:', lastError);
      // Clean up Cloudinary upload in case of analysis failure
      if (uploadedImage?.publicId) {
        await this.cloudinary.delete(uploadedImage.publicId).catch(() => undefined);
      }
      throw new BadRequestException(`AI image analysis failed: ${this.formatGeminiError(lastError)}`);
    }

    // 3. Save to database history
    return this.visionRepository.createHistory(userId, {
      imageUrl: uploadedImage.url,
      imagePublicId: uploadedImage.publicId,
      words: words.map((w: any) => ({
        word: String(w.word || ''),
        meaning: String(w.meaning || ''),
        meaningVi: String(w.meaningVi || ''),
        pronunciation: String(w.pronunciation || ''),
        partOfSpeech: String(w.partOfSpeech || ''),
        exampleSentence: String(w.exampleSentence || ''),
        x: typeof w.x === 'number' ? Math.round(w.x) : undefined,
        y: typeof w.y === 'number' ? Math.round(w.y) : undefined,
      })),
    });
  }

  async saveWordsToFlashcard(userId: string, wordsToSave: SaveVisionWordInput[]) {
    if (!wordsToSave || wordsToSave.length === 0) {
      throw new BadRequestException('No words provided to save');
    }

    const savedResults = [];

    // Find or create default Vision topic
    let topic = await this.prisma.topic.findFirst({
      where: { slug: 'vision-ai-words' },
    });

    if (!topic) {
      topic = await this.prisma.topic.create({
        data: {
          name: 'Vision AI Vocabulary',
          slug: 'vision-ai-words',
          description: 'Vocabulary learned from real-world images.',
          level: 'BEGINNER',
          order: 100,
          isActive: true,
        },
      });
    }

    const wordIdsToMark = [];

    for (const item of wordsToSave) {
      const normalizedWord = item.word.trim().toLowerCase();

      // Check if vocabulary already exists under this topic
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
        // Update with details (e.g. user edits)
        vocab = await this.prisma.vocabulary.update({
          where: { id: vocab.id },
          data: {
            meaning: item.meaning,
            meaningVi: item.meaningVi ?? vocab.meaningVi,
            pronunciation: item.pronunciation ?? vocab.pronunciation,
            partOfSpeech: item.partOfSpeech ?? vocab.partOfSpeech,
            exampleSentence: item.exampleSentence ?? vocab.exampleSentence,
          },
        });
      } else {
        // Create new vocabulary record
        vocab = await this.prisma.vocabulary.create({
          data: {
            topicId: topic.id,
            word: normalizedWord,
            meaning: item.meaning,
            meaningVi: item.meaningVi ?? '',
            pronunciation: item.pronunciation ?? '',
            partOfSpeech: item.partOfSpeech ?? 'noun',
            exampleSentence: item.exampleSentence ?? '',
          },
        });
      }

      // Check for duplicate flashcard before saving
      const existingFlashcard = await this.flashcardRepo.findByUserAndVocabulary(userId, vocab.id);
      let flashcard;
      if (existingFlashcard) {
        flashcard = existingFlashcard;
      } else {
        flashcard = await this.flashcardRepo.save(userId, vocab.id);
      }

      savedResults.push({
        word: normalizedWord,
        vocabularyId: vocab.id,
        flashcardId: flashcard.id,
      });

      wordIdsToMark.push(item.wordId);
    }

    // Mark these words as saved in history
    if (wordIdsToMark.length > 0) {
      await this.visionRepository.markWordsAsSaved(wordIdsToMark);
    }

    return {
      success: true,
      saved: savedResults,
    };
  }

  async analyzeClickCoordinates(
    userId: string,
    historyId: string,
    x?: number,
    y?: number,
    xMin?: number,
    yMin?: number,
    xMax?: number,
    yMax?: number,
  ) {
    const history = await this.getHistoryItem(userId, historyId);
    
    // 1. Fetch image binary from Cloudinary URL
    let imageBuffer: Buffer;
    let mimeType: string;
    try {
      const response = await fetch(history.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      imageBuffer = Buffer.from(await response.arrayBuffer());
      mimeType = response.headers.get('content-type') || 'image/jpeg';
    } catch (err: any) {
      throw new BadRequestException(`Failed to retrieve image from storage: ${err.message || err}`);
    }

    const finalX = x !== undefined && x !== null ? x : Math.round(((xMin ?? 0) + (xMax ?? 0)) / 2);
    const finalY = y !== undefined && y !== null ? y : Math.round(((yMin ?? 0) + (yMax ?? 0)) / 2);

    // 2. Call Gemini Vision
    let wordData: any;
    let lastError: any = null;
    const modelCandidates = ['gemini-flash-latest', 'gemini-2.0-flash'];

    let coordinatePrompt = '';
    if (xMin !== undefined && yMin !== undefined && xMax !== undefined && yMax !== undefined) {
      // Convert percentage boundaries (0-100) to Gemini's native normalized range (0-1000)
      const ymin = Math.round(yMin * 10);
      const xmin = Math.round(xMin * 10);
      const ymax = Math.round(yMax * 10);
      const xmax = Math.round(xMax * 10);

      coordinatePrompt = `You are a spatial grounding model. Locate the object inside the normalized bounding box: [${ymin}, ${xmin}, ${ymax}, ${xmax}]
(where coordinates are normalized to 1000, in the format [ymin, xmin, ymax, xmax], with [0, 0, 1000, 1000] representing the entire image).

Focus strictly on the visual content located inside this bounding box: [${ymin}, ${xmin}, ${ymax}, ${xmax}]. Identify the single, most specific object, bird, or animal located directly within this crop boundary box. Do not describe background elements or prominent objects located elsewhere in the image (such as elephants, giraffes, or sofas) unless they are directly inside this selected box.`;
    } else {
      // Convert point coordinates to a small bounding box on 0-1000 scale
      const targetY = finalY * 10;
      const targetX = finalX * 10;
      const ymin = Math.max(0, targetY - 20);
      const xmin = Math.max(0, targetX - 20);
      const ymax = Math.min(1000, targetY + 20);
      const xmax = Math.min(1000, targetX + 20);

      coordinatePrompt = `You are a spatial grounding model. Locate the object at the normalized coordinates: [${targetY}, ${targetX}], which is centered inside the small normalized bounding box: [${ymin}, ${xmin}, ${ymax}, ${xmax}]
(where coordinates are normalized to 1000, in the format [ymin, xmin, ymax, xmax], with [0, 0, 1000, 1000] representing the entire image).

Focus strictly on the visual content centered at these coordinates. Identify the single, most specific object, bird, or animal located inside the bounding box [${ymin}, ${xmin}, ${ymax}, ${xmax}]. Do not confuse it with larger, more prominent objects located elsewhere in the image (such as elephants, giraffes, or sofas) unless they are centered directly at this coordinate point.`;
    }

    const prompt = `${coordinatePrompt}
Generate its English vocabulary word, type, pronunciation (IPA), English definition, Vietnamese translation, and a simple example sentence.

Output MUST be a valid JSON object matching the following structure:
{
  "word": "...",
  "meaning": "...",
  "meaningVi": "...",
  "pronunciation": "...",
  "partOfSpeech": "...",
  "exampleSentence": "..."
}`;

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
        wordData = JSON.parse(responseText);
        lastError = null;
        break;
      } catch (error: any) {
        lastError = error;
        console.warn(`Vision click model ${modelName} call failed, trying fallback... Error:`, error?.message);
      }
    }

    if (lastError) {
      console.error('Gemini Vision Click API Error:', lastError);
      throw new BadRequestException(`AI point identification failed: ${this.formatGeminiError(lastError)}`);
    }

    // 3. Save new word to DB
    const createdWord = await this.visionRepository.createWord(historyId, {
      word: String(wordData.word || ''),
      meaning: String(wordData.meaning || ''),
      meaningVi: String(wordData.meaningVi || ''),
      pronunciation: String(wordData.pronunciation || ''),
      partOfSpeech: String(wordData.partOfSpeech || ''),
      exampleSentence: String(wordData.exampleSentence || ''),
      x: finalX,
      y: finalY,
    });

    return createdWord;
  }
}

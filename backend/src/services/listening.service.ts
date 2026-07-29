import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../configs/db';
import { ContentLevel } from '@prisma/client';
import * as ytdl from '@distube/ytdl-core';
import {
  CreateListeningTopicDto,
  UpdateListeningTopicDto,
  AutoTranscribeDto,
  UpdateProgressDto,
} from '../controllers/dto/listening/listening.dto';

// Helper to generate slug from title
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

@Injectable()
export class ListeningService {
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // Admin: CRUD - Create
  async createTopic(dto: CreateListeningTopicDto) {
    let slug = slugify(dto.title);
    
    // Ensure slug uniqueness
    const exists = await this.prisma.listeningTopic.findUnique({
      where: { slug },
    });
    if (exists) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    let transcript = dto.transcript || '';
    let sentences = dto.sentences || [];

    if ((sentences.length === 0 || !transcript) && (dto.audioUrl || dto.youtubeUrl)) {
      try {
        const aiData = await this.autoTranscribe({
          audioUrl: dto.audioUrl || undefined,
          youtubeUrl: dto.youtubeUrl || undefined,
        });
        transcript = aiData.transcript;
        sentences = aiData.sentences;
      } catch (error) {
        console.error('Failed to auto-transcribe in createTopic:', error);
        transcript = transcript || 'Transcription failed.';
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const topic = await tx.listeningTopic.create({
        data: {
          title: dto.title,
          slug,
          description: dto.description,
          audioUrl: dto.audioUrl,
          audioPublicId: dto.audioPublicId,
          youtubeUrl: dto.youtubeUrl,
          transcript,
          level: dto.level,
          status: dto.status || 'DRAFT',
          studyMode: dto.studyMode || 'both',
          activeHints: dto.activeHints || ['vietnamese', 'first_letter', 'error_highlight'],
          maxPlays: dto.maxPlays !== undefined ? dto.maxPlays : 5,
          errorLimit: dto.errorLimit !== undefined ? dto.errorLimit : 3,
        },
      });

      if (sentences && sentences.length > 0) {
        await tx.listeningSentence.createMany({
          data: sentences.map((s) => ({
            topicId: topic.id,
            text: s.text,
            vietnameseTranslation: s.vietnameseTranslation,
            startTime: s.startTime,
            endTime: s.endTime,
            order: s.order,
          })),
        });
      }

      return tx.listeningTopic.findUnique({
        where: { id: topic.id },
        include: {
          sentences: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });
  }

  // Admin: CRUD - Update
  async updateTopic(id: string, dto: UpdateListeningTopicDto) {
    const topic = await this.prisma.listeningTopic.findUnique({
      where: { id },
    });
    if (!topic) {
      throw new NotFoundException(`Listening topic with ID ${id} not found`);
    }

    let transcript = dto.transcript;
    let sentences = dto.sentences;

    const sourceChanged = (dto.audioUrl !== undefined && dto.audioUrl !== topic.audioUrl) || 
                          (dto.youtubeUrl !== undefined && dto.youtubeUrl !== topic.youtubeUrl);

    if (sourceChanged && (!sentences || sentences.length === 0)) {
      try {
        const aiData = await this.autoTranscribe({
          audioUrl: dto.audioUrl || topic.audioUrl || undefined,
          youtubeUrl: dto.youtubeUrl || topic.youtubeUrl || undefined,
        });
        transcript = aiData.transcript;
        sentences = aiData.sentences;
      } catch (error) {
        console.error('Failed to auto-transcribe in updateTopic:', error);
      }
    }

    const data: any = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
      data.slug = slugify(dto.title);
      // Ensure unique slug
      const exists = await this.prisma.listeningTopic.findFirst({
        where: { slug: data.slug, id: { not: id } },
      });
      if (exists) {
        data.slug = `${data.slug}-${Date.now().toString().slice(-4)}`;
      }
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.audioUrl !== undefined) data.audioUrl = dto.audioUrl;
    if (dto.audioPublicId !== undefined) data.audioPublicId = dto.audioPublicId;
    if (dto.youtubeUrl !== undefined) data.youtubeUrl = dto.youtubeUrl;
    if (transcript !== undefined) data.transcript = transcript;
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.studyMode !== undefined) data.studyMode = dto.studyMode;
    if (dto.activeHints !== undefined) data.activeHints = dto.activeHints;
    if (dto.maxPlays !== undefined) data.maxPlays = dto.maxPlays;
    if (dto.errorLimit !== undefined) data.errorLimit = dto.errorLimit;

    return this.prisma.$transaction(async (tx) => {
      await tx.listeningTopic.update({
        where: { id },
        data,
      });

      if (sentences !== undefined) {
        // Drop and recreate sentences to maintain order
        await tx.listeningSentence.deleteMany({
          where: { topicId: id },
        });

        if (sentences.length > 0) {
          await tx.listeningSentence.createMany({
            data: sentences.map((s) => ({
              topicId: id,
              text: s.text,
              vietnameseTranslation: s.vietnameseTranslation,
              startTime: s.startTime,
              endTime: s.endTime,
              order: s.order,
            })),
          });
        }
      }

      return tx.listeningTopic.findUnique({
        where: { id },
        include: {
          sentences: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });
  }

  // Admin: CRUD - Delete
  async deleteTopic(id: string) {
    const topic = await this.prisma.listeningTopic.findUnique({
      where: { id },
    });
    if (!topic) {
      throw new NotFoundException(`Listening topic with ID ${id} not found`);
    }
    await this.prisma.listeningTopic.delete({
      where: { id },
    });
    return { success: true };
  }

  // User/Admin: Read Single
  async getTopic(idOrSlug: string, userId?: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
    const query = isObjectId ? { id: idOrSlug } : { slug: idOrSlug };

    const topic = await this.prisma.listeningTopic.findFirst({
      where: query,
      include: {
        sentences: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException(`Listening topic not found`);
    }

    let progress = null;
    if (userId) {
      progress = await this.prisma.listeningProgress.findUnique({
        where: {
          userId_topicId: {
            userId,
            topicId: topic.id,
          },
        },
      });
    }

    return {
      ...topic,
      progress,
    };
  }

  // User/Admin: List with progress and level filter
  async listTopics(filters: { level?: ContentLevel; search?: string; userId?: string }) {
    const where: any = {};
    if (filters.level) {
      where.level = filters.level;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const topics = await this.prisma.listeningTopic.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        sentences: {
          select: { id: true },
        },
      },
    });

    if (filters.userId) {
      const progresses = await this.prisma.listeningProgress.findMany({
        where: { userId: filters.userId },
      });

      const progressMap = new Map(progresses.map((p) => [p.topicId, p]));
      return topics.map((t) => ({
        id: t.id,
        title: t.title,
        slug: t.slug,
        description: t.description,
        level: t.level,
        audioUrl: t.audioUrl,
        youtubeUrl: t.youtubeUrl,
        sentenceCount: t.sentences.length,
        progress: progressMap.get(t.id) || null,
        createdAt: t.createdAt,
      }));
    }

    return topics.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      description: t.description,
      level: t.level,
      audioUrl: t.audioUrl,
      youtubeUrl: t.youtubeUrl,
      sentenceCount: t.sentences.length,
      progress: null,
      createdAt: t.createdAt,
    }));
  }

  // Gemini audio processing & transcription
  async autoTranscribe(dto: AutoTranscribeDto) {
    let audioBuffer: Buffer;
    let mimeType: string;

    if (dto.youtubeUrl) {
      const ytData = await this.downloadYoutubeAudio(dto.youtubeUrl);
      audioBuffer = ytData.buffer;
      mimeType = ytData.mimeType;
    } else if (dto.audioUrl) {
      const response = await fetch(dto.audioUrl);
      if (!response.ok) {
        throw new BadRequestException(`Failed to download audio from ${dto.audioUrl}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
      mimeType = response.headers.get('content-type') || 'audio/mpeg';
    } else {
      throw new BadRequestException('Either audioUrl or youtubeUrl must be provided');
    }

    // Call Gemini API to transcribe
    try {
      const modelCandidates = ['gemini-2.0-flash', 'gemini-flash-latest'];
      let lastError = null;

      const prompt = `
        You are an expert English transcriber. Listen to this audio and perform these tasks:
        1. Transcribe the audio exactly. Clean up filler words like "um", "uh", but do not change the spoken words.
        2. Break the transcription down into logical sentences or phrases that make sense for dictation practice.
        3. For each sentence, provide:
           - "text": The precise spoken English sentence/phrase.
           - "vietnameseTranslation": A natural and accurate Vietnamese translation of the sentence.
           - "startTime": The estimated start time of the sentence in seconds.
           - "endTime": The estimated end time of the sentence in seconds.
        4. Return strictly a JSON array of objects. Each object should have keys: "text", "vietnameseTranslation", "startTime", "endTime".
        Ensure there are no markdown symbols, comments, or wrappers. Provide only the valid JSON array output.
      `;

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
                      data: audioBuffer.toString('base64'),
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

          const resultText = response.response.text();
          const parsed = JSON.parse(resultText);

          if (!Array.isArray(parsed)) {
            throw new Error('Gemini did not return an array');
          }

          // Format sentences and create clean transcript
          const sentences = parsed.map((item: any, index: number) => ({
            text: String(item.text || '').trim(),
            vietnameseTranslation: String(item.vietnameseTranslation || '').trim(),
            startTime: typeof item.startTime === 'number' ? item.startTime : null,
            endTime: typeof item.endTime === 'number' ? item.endTime : null,
            order: index + 1,
          }));

          const fullTranscript = sentences.map((s) => s.text).join(' ');

          return {
            transcript: fullTranscript,
            sentences,
          };
        } catch (err) {
          lastError = err;
          console.warn(`Transcribe failed with model ${modelName}:`, err);
        }
      }

      throw lastError || new Error('Transcribe failed across all models');
    } catch (error) {
      console.error('Transcribe error:', error);
      throw new BadRequestException(`Transcribe error: ${error.message || error}`);
    }
  }

  // Student progress update
  async updateProgress(userId: string, topicId: string, dto: UpdateProgressDto) {
    const topic = await this.prisma.listeningTopic.findUnique({
      where: { id: topicId },
      include: {
        sentences: { select: { id: true } },
      },
    });

    if (!topic) {
      throw new NotFoundException(`Listening topic with ID ${topicId} not found`);
    }

    const totalSentences = topic.sentences.length;
    // Sentence is completed if its ID or index is in completedSentences
    const completed = dto.completedSentences.length >= totalSentences;

    return this.prisma.listeningProgress.upsert({
      where: {
        userId_topicId: {
          userId,
          topicId,
        },
      },
      create: {
        userId,
        topicId,
        completed,
        listenedCount: dto.listenedCount,
        errorCount: dto.errorCount,
        completedSentences: dto.completedSentences,
      },
      update: {
        completed,
        listenedCount: dto.listenedCount,
        errorCount: dto.errorCount,
        completedSentences: dto.completedSentences,
      },
    });
  }

  // Helper: Download audio from YouTube
  private async downloadYoutubeAudio(youtubeUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const info = await ytdl.getInfo(youtubeUrl);
      const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
      if (!format || !format.url) {
        throw new Error('No valid audio stream found for this video');
      }

      // Fetch CDN stream
      const response = await fetch(format.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch stream: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = format.mimeType || 'audio/webm';

      return { buffer, mimeType };
    } catch (err) {
      throw new Error(`YouTube stream download error: ${err.message}`);
    }
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../configs/db';
import { CloudinaryImageService } from '../configs/cloudinary';
import { ContentLevel } from '@prisma/client';
import youtubedl from 'youtube-dl-exec';
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

async function generateUniqueSlug(prisma: PrismaService, title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || 'listening-exercise';
  let candidate = base;
  let attempts = 0;

  while (attempts < 10) {
    const existing = await prisma.listeningTopic.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (!existing) {
      return candidate;
    }

    attempts++;
    candidate = `${base}-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6)}`;
  }

  return `${base}-${Date.now()}`;
}

@Injectable()
export class ListeningService {
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryImageService,
  ) {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // Admin: CRUD - Create
  async createTopic(dto: CreateListeningTopicDto) {
    const slug = await generateUniqueSlug(this.prisma, dto.title);

    let transcript = dto.transcript || '';
    let sentences = dto.sentences || [];
    let audioUrl = dto.audioUrl || null;
    let audioPublicId = dto.audioPublicId || null;

    if ((sentences.length === 0 || !transcript) && (dto.audioUrl || dto.youtubeUrl)) {
      try {
        const aiData = await this.autoTranscribe({
          audioUrl: dto.audioUrl || undefined,
          youtubeUrl: dto.youtubeUrl || undefined,
        });
        transcript = aiData.transcript;
        sentences = aiData.sentences;
        if (aiData.audioUrl && !audioUrl) {
          audioUrl = aiData.audioUrl;
        }
        if (aiData.audioPublicId && !audioPublicId) {
          audioPublicId = aiData.audioPublicId;
        }
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
          audioUrl,
          audioPublicId,
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

    let updatedAudioUrl = dto.audioUrl !== undefined ? dto.audioUrl : topic.audioUrl;
    let updatedAudioPublicId = dto.audioPublicId !== undefined ? dto.audioPublicId : topic.audioPublicId;

    if (sourceChanged && (!sentences || sentences.length === 0)) {
      try {
        const aiData = await this.autoTranscribe({
          audioUrl: dto.audioUrl || topic.audioUrl || undefined,
          youtubeUrl: dto.youtubeUrl || topic.youtubeUrl || undefined,
        });
        transcript = aiData.transcript;
        sentences = aiData.sentences;
        if (aiData.audioUrl) {
          updatedAudioUrl = aiData.audioUrl;
        }
        if (aiData.audioPublicId) {
          updatedAudioPublicId = aiData.audioPublicId;
        }
      } catch (error) {
        console.error('Failed to auto-transcribe in updateTopic:', error);
      }
    }

    const data: any = {};
    if (dto.title !== undefined) {
      data.title = dto.title;
      data.slug = await generateUniqueSlug(this.prisma, dto.title, id);
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (updatedAudioUrl !== undefined) data.audioUrl = updatedAudioUrl;
    if (updatedAudioPublicId !== undefined) data.audioPublicId = updatedAudioPublicId;
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

      // Update sentences if provided
      if (sentences !== undefined) {
        await tx.listeningSentence.deleteMany({
          where: { topicId: id },
        });

        if (sentences.length > 0) {
          await tx.listeningSentence.createMany({
            data: sentences.map((s, index) => ({
              topicId: id,
              text: s.text,
              vietnameseTranslation: s.vietnameseTranslation,
              startTime: s.startTime,
              endTime: s.endTime,
              order: s.order || index + 1,
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

    return this.prisma.listeningTopic.delete({
      where: { id },
    });
  }

  // User/Admin: Get Topic Details with Sentences & Progress
  async getTopic(idOrSlug: string, userId?: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
    const where: any = isObjectId
      ? { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
      : { slug: idOrSlug };

    const topic = await this.prisma.listeningTopic.findFirst({
      where,
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
      include: {
        _count: {
          select: { sentences: true },
        },
        progress: filters.userId
          ? {
              where: { userId: filters.userId },
            }
          : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return topics.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      description: t.description,
      audioUrl: t.audioUrl,
      youtubeUrl: t.youtubeUrl,
      level: t.level,
      status: t.status,
      studyMode: t.studyMode,
      activeHints: t.activeHints,
      maxPlays: t.maxPlays,
      errorLimit: t.errorLimit,
      sentenceCount: t._count.sentences,
      progress: t.progress && t.progress.length > 0 ? t.progress[0] : null,
      createdAt: t.createdAt,
    }));
  }

  // Admin: Get Topic Details for Edit
  async getAdminTopic(idOrSlug: string) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
    const where: any = isObjectId
      ? { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
      : { slug: idOrSlug };

    const topic = await this.prisma.listeningTopic.findFirst({
      where,
      include: {
        sentences: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!topic) {
      throw new NotFoundException(`Listening topic with ID or slug "${idOrSlug}" not found`);
    }

    return topic;
  }

  // Gemini audio processing & transcription
  async autoTranscribe(dto: AutoTranscribeDto) {
    let audioBuffer: Buffer;
    let mimeType: string;
    let convertedAudioUrl: string | undefined;
    let convertedAudioPublicId: string | undefined;

    if (dto.youtubeUrl) {
      const ytData = await this.downloadYoutubeAudio(dto.youtubeUrl);
      audioBuffer = ytData.buffer;
      mimeType = ytData.mimeType;

      // Convert YouTube audio to Cloudinary hosted audio file
      try {
        const uploaded = await this.cloudinaryService.uploadAudio(audioBuffer);
        convertedAudioUrl = uploaded.url;
        convertedAudioPublicId = uploaded.publicId;
      } catch (uploadErr) {
        console.warn('Failed to upload converted YouTube audio to Cloudinary:', uploadErr);
      }
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
            audioUrl: convertedAudioUrl,
            audioPublicId: convertedAudioPublicId,
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

  // Helper: Download audio from YouTube with multi-method fallbacks
  private async downloadYoutubeAudio(youtubeUrl: string): Promise<{ buffer: Buffer; mimeType: string }> {
    // 1. Primary extractor: youtube-dl-exec (yt-dlp with node JS runtime)
    try {
      const streamUrlOutput = await youtubedl(youtubeUrl, {
        getUrl: true,
        format: 'bestaudio',
        jsRuntimes: 'node',
        noCheckCertificates: true,
        noWarnings: true,
      });

      if (streamUrlOutput) {
        const lines = String(streamUrlOutput).trim().split('\n');
        const streamUrl = lines.find((l) => l.trim().startsWith('http'));

        if (streamUrl) {
          const res = await fetch(streamUrl.trim(), {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
          });
          if (res.ok) {
            const ab = await res.arrayBuffer();
            return {
              buffer: Buffer.from(ab),
              mimeType: res.headers.get('content-type') || 'audio/mp4',
            };
          }
        }
      }
    } catch (ytDlpError: any) {
      console.warn('youtube-dl-exec stream extraction warning:', ytDlpError?.message || ytDlpError);
    }

    // 2. Secondary fallback: @distube/ytdl-core
    try {
      const info = await ytdl.getInfo(youtubeUrl);
      const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
      const format = audioFormats.find((f) => f.url);
      if (format && format.url) {
        const response = await fetch(format.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return {
            buffer: Buffer.from(arrayBuffer),
            mimeType: format.mimeType || 'audio/mp4',
          };
        }
      }
    } catch (ytdlError: any) {
      console.warn('ytdl-core fallback warning:', ytdlError?.message || ytdlError);
    }

    throw new BadRequestException('Failed to download YouTube audio stream. Please verify that the YouTube video URL is valid and public.');
  }
}

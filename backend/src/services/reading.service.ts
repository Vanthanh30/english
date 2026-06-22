import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { READING_REPOSITORY, type ReadingRepository } from '../repositories/reading.repository';
import { FLASHCARD_REPOSITORY, type FlashcardRepository } from '../repositories/flashcard.repository';
import { PrismaService } from '../configs/db';
import type {
  ReadingItemModel,
  VocabularyHighlightModel,
  ReadingNoteModel,
  SourceType,
  ReadingStatus,
  HighlightColor,
  ReadingNoteType,
} from '../models/reading.model';
import { extract } from '@extractus/article-extractor';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class ReadingService {
  constructor(
    @Inject(READING_REPOSITORY)
    private readonly repository: ReadingRepository,
    @Inject(FLASHCARD_REPOSITORY)
    private readonly flashcardRepo: FlashcardRepository,
    private readonly prisma: PrismaService,
  ) {}

  // 7.1 Import Reading Material from URL
  async importFromUrl(userId: string, url: string): Promise<ReadingItemModel> {
    try {
      const article = await extract(url);
      if (!article || !article.content) {
        throw new BadRequestException('Could not extract content from the provided URL');
      }

      // Clean HTML tags from content for readability plain-text view or strip ads/scripts
      // We keep clean paragraphs or plain text. The project definition asks for "extracted text".
      // Let's strip HTML tags to get clean plain text, or keep clean paragraph structures.
      const rawText = article.content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      const wordCount = this.calculateWordCount(rawText);
      const title = article.title || 'Untitled Web Article';

      return this.repository.createReadingItem(userId, {
        title,
        sourceType: 'URL',
        sourceUrl: url,
        content: rawText,
        wordCount,
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to import URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 7.1 Upload and parse PDF, DOCX, TXT
  async importFromFile(
    userId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string },
  ): Promise<ReadingItemModel> {
    let content = '';
    let sourceType: SourceType = 'TXT';

    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'pdf' || file.mimetype === 'application/pdf') {
      sourceType = 'PDF';
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
      sourceType = 'DOCX';
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        content = result.value;
      } catch (err) {
        throw new BadRequestException('Failed to parse Word document');
      }
    } else if (ext === 'txt' || file.mimetype === 'text/plain') {
      sourceType = 'TXT';
      content = file.buffer.toString('utf-8');
    } else {
      throw new BadRequestException('Unsupported file format. Only PDF, DOCX, and TXT are supported.');
    }

    if (!content.trim()) {
      throw new BadRequestException('Extracted content is empty');
    }

    const wordCount = this.calculateWordCount(content);
    return this.repository.createReadingItem(userId, {
      title: file.originalname,
      sourceType,
      content,
      wordCount,
    });
  }

  // 7.8 Library view
  async listLibrary(
    userId: string,
    filters?: { status?: ReadingStatus; sourceType?: SourceType; search?: string },
  ): Promise<ReadingItemModel[]> {
    return this.repository.findReadingItemsByUser(userId, filters);
  }

  async getReadingItem(userId: string, id: string): Promise<ReadingItemModel> {
    const item = await this.repository.findReadingItemById(userId, id);
    if (!item) {
      throw new NotFoundException('Reading item not found');
    }
    return item;
  }

  async deleteReadingItem(userId: string, id: string): Promise<void> {
    const item = await this.repository.findReadingItemById(userId, id);
    if (!item) {
      throw new NotFoundException('Reading item not found');
    }
    await this.repository.deleteReadingItem(userId, id);
  }

  // 7.7 Bookmark & Status updates
  async updateBookmark(userId: string, id: string, position: number): Promise<ReadingItemModel> {
    const item = await this.repository.findReadingItemById(userId, id);
    if (!item) {
      throw new NotFoundException('Reading item not found');
    }
    return this.repository.updateBookmark(userId, id, position);
  }

  async updateStatus(userId: string, id: string, status: ReadingStatus): Promise<ReadingItemModel> {
    const item = await this.repository.findReadingItemById(userId, id);
    if (!item) {
      throw new NotFoundException('Reading item not found');
    }
    return this.repository.updateStatus(userId, id, status);
  }

  // 7.3 Highlights
  async listHighlights(userId: string, readingItemId: string): Promise<VocabularyHighlightModel[]> {
    return this.repository.findHighlightsByReadingItem(userId, readingItemId);
  }

  async addHighlight(
    userId: string,
    readingItemId: string,
    data: { word: string; color: HighlightColor; charOffset: number },
  ): Promise<VocabularyHighlightModel> {
    const item = await this.repository.findReadingItemById(userId, readingItemId);
    if (!item) {
      throw new NotFoundException('Reading item not found');
    }
    const exists = await this.repository.highlightExists(userId, readingItemId, data.word, data.charOffset);
    if (exists) {
      return (await this.repository.findHighlightsByReadingItem(userId, readingItemId))
        .find(h => h.word === data.word && h.charOffset === data.charOffset)!;
    }
    return this.repository.createHighlight(userId, readingItemId, data);
  }

  async removeHighlight(userId: string, readingItemId: string, highlightId: string): Promise<void> {
    await this.repository.deleteHighlight(userId, readingItemId, highlightId);
  }

  // 7.6 Notes side panel
  async listNotes(userId: string, readingItemId: string): Promise<ReadingNoteModel[]> {
    return this.repository.findNotesByReadingItem(userId, readingItemId);
  }

  async createNote(
    userId: string,
    readingItemId: string,
    data: { noteType: ReadingNoteType; content: string },
  ): Promise<ReadingNoteModel> {
    const item = await this.repository.findReadingItemById(userId, readingItemId);
    if (!item) {
      throw new NotFoundException('Reading item not found');
    }
    return this.repository.createNote(userId, readingItemId, data);
  }

  async updateNote(
    userId: string,
    readingItemId: string,
    noteId: string,
    content: string,
  ): Promise<ReadingNoteModel> {
    const note = await this.repository.findNoteById(userId, readingItemId, noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    return this.repository.updateNote(userId, readingItemId, noteId, content);
  }

  async deleteNote(userId: string, readingItemId: string, noteId: string): Promise<void> {
    const note = await this.repository.findNoteById(userId, readingItemId, noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    await this.repository.deleteNote(userId, readingItemId, noteId);
  }

  async translateToVietnamese(text: string): Promise<string> {
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(
          text.trim(),
        )}`,
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data[0] && Array.isArray(data[0])) {
          return data[0].map((item: any) => item[0]).join('');
        }
      }
    } catch (e) {
      console.error('Translation error', e);
    }
    return '';
  }

  // 7.4 Dictionary Lookup & Translation
  async lookupWord(word: string) {
    const normalizedWord = word.trim();
    const isPhrase = normalizedWord.includes(' ') || normalizedWord.includes('-') || normalizedWord.length > 25;

    if (isPhrase) {
      const translation = await this.translateToVietnamese(normalizedWord);
      return {
        word: normalizedWord,
        meaningVi: translation || 'Không thể dịch cụm từ này',
        meaning: 'Cụm từ / câu dịch nghĩa tự động',
        pronunciation: '',
        partOfSpeech: 'phrase',
        exampleSentence: '',
        audioUrl: '',
        vocabularyId: null,
        isLocal: false,
        isPhrase: true,
      };
    }

    const lowerWord = normalizedWord.toLowerCase();

    // 1. Search in local vocabulary database (curated list)
    const localWord = await this.prisma.vocabulary.findFirst({
      where: {
        word: {
          equals: lowerWord,
          mode: 'insensitive',
        },
      },
      include: {
        topic: { select: { name: true } },
      },
    });

    let meaningVi = '';
    if (localWord && localWord.meaningVi) {
      meaningVi = localWord.meaningVi;
    } else {
      meaningVi = await this.translateToVietnamese(normalizedWord);
    }

    if (localWord) {
      return {
        word: localWord.word,
        meaningVi: meaningVi,
        meaning: localWord.meaning,
        pronunciation: localWord.pronunciation || '',
        partOfSpeech: localWord.partOfSpeech || '',
        exampleSentence: localWord.exampleSentence || '',
        audioUrl: localWord.audioUrl || '',
        vocabularyId: localWord.id,
        isLocal: true,
        isPhrase: false,
      };
    }

    // 2. Fallback: Free Dictionary API
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lowerWord)}`,
      );
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const entry = data[0];
          
          // Smart parsing: prioritize the first definition that has both a description and an example sentence
          let meaning = entry.meanings?.[0];
          let definition = meaning?.definitions?.[0];
          let foundWithExample = false;

          if (entry.meanings) {
            for (const m of entry.meanings) {
              if (m.definitions) {
                for (const d of m.definitions) {
                  if (d.definition && d.example) {
                    meaning = m;
                    definition = d;
                    foundWithExample = true;
                    break;
                  }
                }
              }
              if (foundWithExample) break;
            }
          }

          const phonetics =
            entry.phonetics?.find((p: any) => p.text && p.audio) || entry.phonetics?.[0];

          return {
            word: entry.word,
            meaningVi: meaningVi || 'Không tìm thấy nghĩa tiếng Việt',
            meaning: definition?.definition || '',
            pronunciation: entry.phonetic || phonetics?.text || '',
            partOfSpeech: meaning?.partOfSpeech || '',
            exampleSentence: definition?.example || '',
            audioUrl: phonetics?.audio || '',
            vocabularyId: null,
            isLocal: false,
            isPhrase: false,
          };
        }
      }
    } catch (e) {
      console.error('Error fetching from dictionary API', e);
    }

    return {
      word: normalizedWord,
      meaningVi: meaningVi || 'Không tìm thấy nghĩa',
      meaning: 'No definition found',
      pronunciation: '',
      partOfSpeech: '',
      exampleSentence: '',
      audioUrl: '',
      vocabularyId: null,
      isLocal: false,
      isPhrase: false,
    };
  }

  // 7.5 Flashcard Integration - Save Word to Flashcard (auto-creating Vocabulary in local DB if needed)
  async saveWordToFlashcard(
    userId: string,
    wordInfo: {
      word: string;
      meaning: string;
      meaningVi?: string;
      pronunciation?: string;
      partOfSpeech?: string;
      exampleSentence?: string;
    },
  ) {
    const normalizedWord = wordInfo.word.trim().toLowerCase();

    // Check if the vocabulary already exists under any topic
    let vocab = await this.prisma.vocabulary.findFirst({
      where: {
        word: {
          equals: normalizedWord,
          mode: 'insensitive',
        },
      },
    });

    if (!vocab) {
      // Find or create a default topic for imported reading words
      let topic = await this.prisma.topic.findFirst({
        where: { slug: 'imported-reading-words' },
      });

      if (!topic) {
        topic = await this.prisma.topic.create({
          data: {
            name: 'Imported Reading Words',
            slug: 'imported-reading-words',
            description: 'Words imported from the Reading Workspace.',
            level: 'INTERMEDIATE',
            order: 99,
            isActive: true,
          },
        });
      }

      // Create new vocabulary record
      vocab = await this.prisma.vocabulary.create({
        data: {
          topicId: topic.id,
          word: normalizedWord,
          meaning: wordInfo.meaning || 'Imported from reading workspace',
          meaningVi: wordInfo.meaningVi || '',
          pronunciation: wordInfo.pronunciation || '',
          partOfSpeech: wordInfo.partOfSpeech || 'noun',
          exampleSentence: wordInfo.exampleSentence || '',
        },
      });
    }

    // Check for duplicate flashcard before saving
    const existingFlashcard = await this.flashcardRepo.findByUserAndVocabulary(userId, vocab.id);
    if (existingFlashcard) {
      return { success: false, alreadySaved: true, flashcard: existingFlashcard };
    }

    // Save to flashcard (spaced repetition schedule - default Medium difficulty = 2 days)
    const flashcard = await this.flashcardRepo.save(userId, vocab.id);
    return { success: true, alreadySaved: false, flashcard };
  }

  private calculateWordCount(text: string): number {
    if (!text) return 0;
    const cleanText = text.trim();
    if (!cleanText) return 0;
    return cleanText.split(/\s+/).length;
  }
}

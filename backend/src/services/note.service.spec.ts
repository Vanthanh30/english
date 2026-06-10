import { NotFoundException } from '@nestjs/common';
import type { NoteModel } from '../models/note.model';
import type { NoteRepository } from '../repositories/note.repository';
import { NoteService } from './note.service';

const note: NoteModel = {
  id: '507f1f77bcf86cd799439011',
  ownerId: '507f191e810c19729de860ea',
  title: 'Travel phrases',
  contentHtml: '<p>Where is the station?</p>',
  createdAt: new Date('2026-06-07T00:00:00.000Z'),
  updatedAt: new Date('2026-06-07T00:00:00.000Z'),
};

function createRepository(): jest.Mocked<NoteRepository> {
  return {
    list: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findSavedVocabularyNote: jest.fn(),
    createFromVocabulary: jest.fn(),
    findVocabularyForNote: jest.fn(),
    listSavedVocabulary: jest.fn(),
  };
}

describe('NoteService', () => {
  let repository: jest.Mocked<NoteRepository>;
  let service: NoteService;

  beforeEach(() => {
    repository = createRepository();
    service = new NoteService(repository);
  });

  it('sanitizes unsafe HTML before storing a note', async () => {
    repository.create.mockResolvedValue(note);

    await service.create(note.ownerId, {
      title: ' Travel phrases ',
      contentHtml:
        '<p onclick="alert(1)">Safe</p><script>alert(1)</script><a href="javascript:alert(1)">Bad link</a>',
    });

    expect(repository.create.mock.calls[0]).toEqual([
      note.ownerId,
      expect.objectContaining({
        title: 'Travel phrases',
        contentHtml:
          '<p>Safe</p><a target="_blank" rel="noopener noreferrer">Bad link</a>',
      }),
    ]);
    const stored = repository.create.mock.calls[0][1];
    expect(stored.searchText).toContain('Travel phrases Safe Bad link');
    expect(stored.searchText).not.toContain('alert');
  });

  it('always scopes reads and updates to the authenticated owner', async () => {
    repository.findById.mockResolvedValue(note);
    repository.update.mockResolvedValue(note);

    await service.update(note.ownerId, note.id, {
      title: note.title,
      contentHtml: note.contentHtml,
    });

    expect(repository.findById.mock.calls[0]).toEqual([note.ownerId, note.id]);
    expect(repository.update.mock.calls[0]).toEqual([
      note.ownerId,
      note.id,
      expect.any(Object),
    ]);
  });

  it('returns not found when a note is outside the owner scope', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.get('another-user', note.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findById.mock.calls[0]).toEqual([
      'another-user',
      note.id,
    ]);
  });

  it('returns paginated search results', async () => {
    repository.list.mockResolvedValue({ items: [note], total: 5 });

    await expect(
      service.list(note.ownerId, { page: 2, limit: 2, search: ' travel ' }),
    ).resolves.toEqual({
      items: [note],
      total: 5,
      page: 2,
      limit: 2,
      totalPages: 3,
    });
    expect(repository.list.mock.calls[0]).toEqual([
      note.ownerId,
      {
        page: 2,
        limit: 2,
        search: 'travel',
      },
    ]);
  });

  it('creates a study note from vocabulary once', async () => {
    repository.findSavedVocabularyNote.mockResolvedValue(null);
    repository.findVocabularyForNote.mockResolvedValue({
      id: '507f1f77bcf86cd799439012',
      word: 'departure',
      meaning: 'the act of leaving',
      meaningVi: 'sự khởi hành',
      pronunciation: '/dɪˈpɑːrtʃər/',
      partOfSpeech: 'noun',
      exampleSentence: 'The departure gate is on the second floor.',
      topic: { name: 'Travel Essentials' },
    });
    repository.createFromVocabulary.mockResolvedValue(note);

    const result = await service.saveVocabulary(
      note.ownerId,
      '507f1f77bcf86cd799439012',
      '507f1f77bcf86cd799439013',
    );

    expect(result).toEqual({ saved: true, created: true, note });
    const createCall = repository.createFromVocabulary.mock.calls[0];
    expect(createCall[0]).toBe(note.ownerId);
    expect(createCall[3].title).toBe('departure - Vocabulary note');
    expect(createCall[3].contentHtml).toContain('<h2>Vietnamese meaning</h2>');
    expect(createCall[3].contentHtml).toContain('<h2>English definition</h2>');
    expect(createCall[3].contentHtml).toContain('<h2>My notes</h2>');
  });

  it('returns the existing vocabulary note without creating a duplicate', async () => {
    repository.findSavedVocabularyNote.mockResolvedValue(note);

    await expect(
      service.saveVocabulary(note.ownerId, '507f1f77bcf86cd799439012'),
    ).resolves.toEqual({ saved: true, created: false, note });
    expect(repository.createFromVocabulary.mock.calls).toHaveLength(0);
  });

  it('lists saved vocabulary separately from personal notes', async () => {
    repository.listSavedVocabulary.mockResolvedValue([]);

    await expect(service.listSavedVocabulary(note.ownerId)).resolves.toEqual(
      [],
    );
    expect(repository.listSavedVocabulary.mock.calls[0]).toEqual([
      note.ownerId,
    ]);
  });
});

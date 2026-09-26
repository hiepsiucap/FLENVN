import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Book } from './book.entity';
import { BooksService } from './books.service';
import type { CreateBookDto } from './dto/create-book.dto';
import type { UpdateBookDto } from './dto/update-book.dto';
import type { SubscriptionsService } from '../subscriptions/subscriptions.service';
import type { ManagedImageService } from '../uploads/managed-image.service';

describe('book hierarchy', () => {
  const userId = 'owner';
  let books: Map<string, Book>;
  let manager: ReturnType<typeof makeManager>;
  let repository: ReturnType<typeof makeRepository>;
  let service: BooksService;

  function makeManager() {
    return {
      findOne: jest.fn((_entity: unknown, options: { where: { id: string } }) =>
        Promise.resolve(books.get(options.where.id) ?? null),
      ),
      count: jest.fn(
        (_entity: unknown, options: { where: { parentBookId: string } }) =>
          Promise.resolve(
            [...books.values()].filter(
              (book) => book.parentBookId === options.where.parentBookId,
            ).length,
          ),
      ),
      save: jest.fn((_entity: unknown, book: Book) => Promise.resolve(book)),
      query: jest.fn(() => Promise.resolve([] as unknown[])),
      delete: jest.fn(() => Promise.resolve()),
    };
  }

  function makeRepository() {
    return {
      findOne: jest.fn((options: { where: { id: string } }) =>
        Promise.resolve(books.get(options.where.id) ?? null),
      ),
      find: jest.fn(() => Promise.resolve([...books.values()])),
      create: jest.fn((value: Partial<Book>) => value as Book),
      save: jest.fn((book: Book) => Promise.resolve(book)),
      manager: {
        transaction: jest.fn(
          (callback: (manager: typeof manager) => Promise<unknown>) =>
            callback(manager),
        ),
      },
    };
  }

  beforeEach(() => {
    books = new Map();
    manager = makeManager();
    repository = makeRepository();
    const subscriptions = {
      canAddBook: jest.fn(() => Promise.resolve(true)),
      canAddWords: jest.fn(() => Promise.resolve(true)),
      updateUserUsage: jest.fn(() => Promise.resolve()),
    };
    service = new BooksService(
      repository as unknown as Repository<Book>,
      subscriptions as unknown as SubscriptionsService,
      {} as ManagedImageService,
    );
  });

  function addBook(
    id: string,
    owner = userId,
    parentBookId: string | null = null,
  ) {
    const book = { id, userId: owner, parentBookId, wordCount: 0 } as Book;
    books.set(id, book);
    return book;
  }

  it('rejects creating a book below a sub-book', async () => {
    addBook('parent');
    addBook('child', userId, 'parent');

    await expect(
      service.createBook(userId, {
        title: 'Too deep',
        parentBookId: 'child',
      } as CreateBookDto),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects creating a sub-book under another user’s book', async () => {
    addBook('other-parent', 'other-user');

    await expect(
      service.createBook(userId, {
        title: 'Not mine',
        parentBookId: 'other-parent',
      } as CreateBookDto),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects moving a parent with sub-books below another book', async () => {
    addBook('parent');
    addBook('child', userId, 'parent');
    addBook('destination');

    await expect(
      service.updateBook('parent', userId, {
        parentBookId: 'destination',
      } as UpdateBookDto),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks deleting a parent while it has sub-books', async () => {
    addBook('parent');
    addBook('child', userId, 'parent');

    await expect(service.deleteBook('parent', userId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('does not expose another user’s private parent through a public book', async () => {
    addBook('private-parent', 'other-user');
    const publicChild = addBook('public-child', 'other-user', 'private-parent');
    publicChild.isPublic = true;

    const response = await service.getBookById('public-child', userId);
    expect(response.parentBookId).toBeNull();
  });

  it('keeps the public book catalogue flat', async () => {
    const publicChild = addBook('public-child', 'other-user', 'private-parent');
    publicChild.isPublic = true;

    const response = await service.getPublicBooks();
    expect(response[0].parentBookId).toBeNull();
  });

  it('keeps a concurrent move when a title-only edit saves', async () => {
    const movedBook = addBook('child', userId, 'parent');
    repository.findOne.mockResolvedValueOnce({
      ...movedBook,
      parentBookId: null,
    });

    const response = await service.updateBook('child', userId, {
      title: 'Updated title',
    });
    expect(response.parentBookId).toBe('parent');
  });
});

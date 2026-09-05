import type { Repository } from 'typeorm';
import { FlashCard } from '../flashcards/flashcard.entity';
import { LabelSource } from '../labels/flashcard-label.entity';
import { Label, LabelType } from '../labels/label.entity';
import { Book } from './book.entity';
import { BooksService } from './books.service';

describe('BooksService flashcard labels', () => {
  const label = {
    id: 'label-1',
    userId: 'user-1',
    name: 'Technology',
    normalizedName: 'technology',
    type: LabelType.TOPIC,
    color: null,
  } as Label;
  function createService() {
    const flashcard = {
      id: 'flashcard-1',
      labelLinks: [
        {
          flashcardId: 'flashcard-1',
          labelId: 'label-1',
          source: LabelSource.GEMINI,
          confirmedByUser: false,
          label,
        },
      ],
    } as FlashCard;
    const book = {
      id: 'book-1',
      userId: 'user-1',
      isPublic: false,
      flashcards: [flashcard],
    } as Book;
    const repository = {
      find: jest.fn().mockResolvedValue([book]),
      findOne: jest.fn().mockResolvedValue(book),
    };
    const service = new BooksService(
      repository as unknown as Repository<Book>,
      {} as never,
    );
    return { service, repository };
  }

  it('returns labels for flashcards embedded in the books list', async () => {
    const { service, repository } = createService();

    const result = await service.getBooks('user-1');

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: { flashcards: { labelLinks: { label: true } } },
      }),
    );
    expect(result[0].flashcards[0].labels).toEqual([
      expect.objectContaining({
        name: 'Technology',
        source: LabelSource.GEMINI,
        confirmedByUser: false,
      }),
    ]);
    expect(result[0].flashcards[0].labelLinks).toBeUndefined();
  });

  it('returns labels for flashcards embedded in one book', async () => {
    const { service, repository } = createService();

    const result = await service.getBookById('book-1', 'user-1');

    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: { flashcards: { labelLinks: { label: true } } },
      }),
    );
    expect(result.flashcards[0].labels?.[0].name).toBe('Technology');
  });
});

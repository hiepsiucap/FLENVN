import { BadRequestException, ConflictException } from '@nestjs/common';
import { LabelType } from './label.entity';
import { LabelsService } from './labels.service';

describe('LabelsService', () => {
  const labelRepository = {
    countBy: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const transactionManager = {
    delete: jest.fn(),
    insert: jest.fn(),
  };
  const flashcardLabelRepository = {
    manager: {
      transaction: jest.fn(
        (callback: (manager: typeof transactionManager) => unknown) =>
          Promise.resolve(callback(transactionManager)),
      ),
    },
  };
  const flashcardRepository = {
    findOne: jest.fn(),
  };

  let service: LabelsService;

  beforeEach(() => {
    jest.resetAllMocks();
    flashcardLabelRepository.manager.transaction.mockImplementation(
      (callback: (manager: typeof transactionManager) => unknown) =>
        Promise.resolve(callback(transactionManager)),
    );
    service = new LabelsService(
      labelRepository as never,
      flashcardLabelRepository as never,
      flashcardRepository as never,
    );
  });

  it('normalizes names before creating a label', async () => {
    labelRepository.countBy.mockResolvedValue(0);
    labelRepository.findOne.mockResolvedValue(null);
    labelRepository.create.mockImplementation((value: unknown) => value);
    labelRepository.save.mockImplementation((value: unknown) => value);

    const result = await service.createLabel('user-1', {
      name: '  Travel  ',
    });

    expect(result).toMatchObject({
      userId: 'user-1',
      name: 'Travel',
      normalizedName: 'travel',
      type: LabelType.CUSTOM,
    });
  });

  it('rejects a duplicate normalized name', async () => {
    labelRepository.countBy.mockResolvedValue(1);
    labelRepository.findOne.mockResolvedValue({ id: 'existing-label' });

    await expect(
      service.createLabel('user-1', { name: ' TRAVEL ' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects assigning labels owned by another user', async () => {
    flashcardRepository.findOne.mockResolvedValue({
      id: 'flashcard-1',
      userId: 'user-1',
    });
    labelRepository.find.mockResolvedValue([]);

    await expect(
      service.replaceFlashcardLabels('user-1', 'flashcard-1', {
        labelIds: ['1a8e7e56-a54a-47a7-b755-925063f088cc'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(flashcardLabelRepository.manager.transaction).not.toHaveBeenCalled();
  });
});

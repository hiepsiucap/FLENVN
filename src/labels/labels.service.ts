import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FlashCard, FlashCardStatus } from '../flashcards/flashcard.entity';
import { AssignFlashcardLabelsDto } from './dto/assign-flashcard-labels.dto';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { FlashcardLabel, LabelSource } from './flashcard-label.entity';
import { normalizeLabelName } from './label-taxonomy';
import { Label, LabelType } from './label.entity';

const MAX_LABELS_PER_USER = 100;

interface LabelCountRow {
  id: string;
  totalCards: string;
  dueCards: string;
}

@Injectable()
export class LabelsService {
  constructor(
    @InjectRepository(Label)
    private readonly labelRepository: Repository<Label>,
    @InjectRepository(FlashcardLabel)
    private readonly flashcardLabelRepository: Repository<FlashcardLabel>,
    @InjectRepository(FlashCard)
    private readonly flashcardRepository: Repository<FlashCard>,
  ) {}

  async createLabel(userId: string, dto: CreateLabelDto): Promise<Label> {
    const name = dto.name.trim();
    const normalizedName = normalizeLabelName(name);
    const [count, existing] = await Promise.all([
      this.labelRepository.countBy({ userId }),
      this.labelRepository.findOne({ where: { userId, normalizedName } }),
    ]);

    if (existing) {
      throw new ConflictException('A label with this name already exists');
    }
    if (count >= MAX_LABELS_PER_USER) {
      throw new BadRequestException(
        `You can create at most ${MAX_LABELS_PER_USER} labels`,
      );
    }

    return this.labelRepository.save(
      this.labelRepository.create({
        userId,
        name,
        normalizedName,
        type: dto.type ?? LabelType.CUSTOM,
        color: dto.color ?? null,
      }),
    );
  }

  async getLabels(
    userId: string,
    includeCounts = false,
  ): Promise<Array<Label & { totalCards?: number; dueCards?: number }>> {
    const labels = await this.labelRepository.find({
      where: { userId },
      order: { type: 'ASC', name: 'ASC' },
    });
    if (!includeCounts || labels.length === 0) return labels;

    const rows = await this.labelRepository
      .createQueryBuilder('label')
      .leftJoin('label.flashcardLinks', 'link')
      .leftJoin('link.flashcard', 'flashcard')
      .select('label.id', 'id')
      .addSelect('COUNT(flashcard.id)', 'totalCards')
      .addSelect(
        `COUNT(flashcard.id) FILTER (WHERE
          (flashcard.nextReviewDate IS NULL OR flashcard.nextReviewDate <= :now)
          AND flashcard.status != :masteredStatus
        )`,
        'dueCards',
      )
      .where('label.userId = :userId', { userId })
      .setParameters({
        now: new Date(),
        masteredStatus: FlashCardStatus.MASTERED,
      })
      .groupBy('label.id')
      .getRawMany<LabelCountRow>();

    const counts = new Map(
      rows.map((row) => [
        row.id,
        {
          totalCards: Number.parseInt(row.totalCards, 10),
          dueCards: Number.parseInt(row.dueCards, 10),
        },
      ]),
    );

    return labels.map((label) => ({
      ...label,
      ...(counts.get(label.id) ?? { totalCards: 0, dueCards: 0 }),
    }));
  }

  async updateLabel(
    userId: string,
    labelId: string,
    dto: UpdateLabelDto,
  ): Promise<Label> {
    const label = await this.getOwnedLabel(userId, labelId);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const normalizedName = normalizeLabelName(name);
      const duplicate = await this.labelRepository.findOne({
        where: { userId, normalizedName },
      });
      if (duplicate && duplicate.id !== label.id) {
        throw new ConflictException('A label with this name already exists');
      }
      label.name = name;
      label.normalizedName = normalizedName;
    }
    if (dto.color !== undefined) label.color = dto.color;
    return this.labelRepository.save(label);
  }

  async deleteLabel(
    userId: string,
    labelId: string,
  ): Promise<{ message: string }> {
    const label = await this.getOwnedLabel(userId, labelId);
    await this.labelRepository.remove(label);
    return { message: 'Label deleted successfully' };
  }

  async replaceFlashcardLabels(
    userId: string,
    flashcardId: string,
    dto: AssignFlashcardLabelsDto,
  ): Promise<Label[]> {
    const flashcard = await this.flashcardRepository.findOne({
      where: { id: flashcardId, userId },
    });
    if (!flashcard) throw new NotFoundException('Flashcard not found');

    const labelIds = Array.from(new Set(dto.labelIds));
    const labels = labelIds.length
      ? await this.labelRepository.find({
          where: { id: In(labelIds), userId },
        })
      : [];
    if (labels.length !== labelIds.length) {
      throw new BadRequestException(
        'One or more labels do not exist or belong to another user',
      );
    }

    await this.flashcardLabelRepository.manager.transaction(async (manager) => {
      await manager.delete(FlashcardLabel, { flashcardId });
      if (labels.length > 0) {
        await manager.insert(
          FlashcardLabel,
          labels.map((label) => ({
            flashcardId,
            labelId: label.id,
            source: LabelSource.MANUAL,
            confirmedByUser: true,
          })),
        );
      }
    });

    return labels;
  }

  async getOwnedLabels(userId: string, labelIds: string[]): Promise<Label[]> {
    if (labelIds.length === 0) return [];
    const uniqueIds = Array.from(new Set(labelIds));
    const labels = await this.labelRepository.find({
      where: { id: In(uniqueIds), userId },
    });
    if (labels.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more labels do not exist or belong to another user',
      );
    }
    return labels;
  }

  private async getOwnedLabel(userId: string, labelId: string): Promise<Label> {
    const label = await this.labelRepository.findOne({
      where: { id: labelId, userId },
    });
    if (!label) throw new NotFoundException('Label not found');
    return label;
  }
}

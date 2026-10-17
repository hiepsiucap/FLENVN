import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import {
  Submission,
  SubmissionStatus,
  SubmissionType,
} from './submission.entity';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private readonly repository: Repository<Submission>,
    private readonly configService: ConfigService,
  ) {}

  create(
    userId: string,
    type: SubmissionType,
    dto: CreateSubmissionDto,
  ): Promise<Submission> {
    const message = dto.message.trim();
    if (!message) throw new BadRequestException('Message cannot be blank');
    const subject = dto.subject?.trim() || null;
    if (dto.evidenceImageUrl)
      this.validateEvidenceImageUrl(userId, dto.evidenceImageUrl);
    return this.repository.save(
      this.repository.create({
        userId,
        type,
        message,
        subject,
        status: SubmissionStatus.PENDING,
        evidenceImageUrl: dto.evidenceImageUrl ?? null,
      }),
    );
  }

  findMine(userId: string): Promise<Submission[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findMineById(userId: string, id: string): Promise<Submission> {
    const submission = await this.repository.findOne({ where: { id, userId } });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async updateStatus(
    id: string,
    status: SubmissionStatus,
  ): Promise<Submission> {
    const submission = await this.repository.findOne({ where: { id } });
    if (!submission) throw new NotFoundException('Submission not found');
    submission.status = status;
    return this.repository.save(submission);
  }

  private validateEvidenceImageUrl(userId: string, imageUrl: string): void {
    const bucket = this.configService.get<string>('services.aws.s3.bucket');
    const region =
      this.configService.get<string>('services.aws.s3.region') || 'us-east-1';
    let url: URL;
    try {
      url = new URL(imageUrl);
    } catch {
      throw new BadRequestException('Invalid evidence image URL');
    }
    if (
      !bucket ||
      url.protocol !== 'https:' ||
      url.hostname !== `${bucket}.s3.${region}.amazonaws.com` ||
      !url.pathname.startsWith(`/images/submissions/${userId}/`) ||
      url.pathname.endsWith('/') ||
      url.search ||
      url.hash
    ) {
      throw new BadRequestException(
        'Evidence image must be uploaded by this user',
      );
    }
  }

  findAll(): Promise<Submission[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }
}

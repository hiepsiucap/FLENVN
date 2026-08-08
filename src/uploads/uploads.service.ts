import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../config/app-config.service';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

export interface BufferedUploadFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class UploadsService {
  private readonly s3Client: S3Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly appConfigService: AppConfigService,
  ) {
    const region =
      this.configService.get<string>('services.aws.s3.region') || 'us-east-1';
    const accessKeyId = this.configService.get<string>(
      'services.aws.accessKeyId',
    );
    const secretAccessKey = this.configService.get<string>(
      'services.aws.secretAccessKey',
    );

    this.s3Client = new S3Client({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  async createImageUploadUrl(userId: string, dto: CreateUploadUrlDto) {
    const bucket = this.configService.get<string>('services.aws.s3.bucket');
    const region =
      this.configService.get<string>('services.aws.s3.region') || 'us-east-1';
    const expiresIn = this.configService.get<number>(
      'services.aws.s3.signedUrlExpires',
      3600,
    );

    if (!bucket) {
      throw new InternalServerErrorException('AWS_S3_BUCKET is not configured');
    }

    if (!this.appConfigService.allowedMimeTypes.includes(dto.contentType)) {
      throw new BadRequestException('Unsupported content type');
    }

    const folder = dto.folder || 'images';
    const extension = this.resolveExtension(dto);
    const objectKey = `${folder}/${userId}/${Date.now()}-${randomUUID()}${extension}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`;

    return {
      uploadUrl,
      fileUrl,
      objectKey,
      expiresIn,
    };
  }

  async uploadFile(
    userId: string,
    file: BufferedUploadFile,
    folder: string,
    allowedMimeTypes = this.appConfigService.allowedMimeTypes,
  ) {
    const bucket = this.configService.get<string>('services.aws.s3.bucket');
    const region =
      this.configService.get<string>('services.aws.s3.region') || 'us-east-1';

    if (!bucket) {
      throw new InternalServerErrorException('AWS_S3_BUCKET is not configured');
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported content type');
    }

    if (file.size > this.appConfigService.maxFileSize) {
      throw new BadRequestException('File size exceeds the configured limit');
    }

    const extension = this.resolveExtension({
      contentType: file.mimetype,
      fileName: file.originalname,
    });
    const objectKey = `${folder}/${userId}/${Date.now()}-${randomUUID()}${extension}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return {
      fileUrl: `https://${bucket}.s3.${region}.amazonaws.com/${objectKey}`,
      objectKey,
    };
  }

  private resolveExtension(dto: CreateUploadUrlDto): string {
    if (dto.fileName?.includes('.')) {
      return `.${dto.fileName.split('.').pop()?.toLowerCase()}`;
    }

    const contentTypeParts = dto.contentType.split('/');
    if (contentTypeParts.length === 2 && contentTypeParts[1]) {
      const ext = contentTypeParts[1].toLowerCase();
      if (ext === 'jpeg') {
        return '.jpg';
      }
      return `.${ext}`;
    }

    return '';
  }
}

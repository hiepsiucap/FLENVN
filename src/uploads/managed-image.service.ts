import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import sharp from 'sharp';

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export type ManagedImageKind = 'flashcard' | 'book';

export interface ManagedImage {
  fileUrl: string;
  objectKey: string;
}

@Injectable()
export class ManagedImageService {
  private readonly client: S3Client;
  private readonly bucket?: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('services.aws.s3.bucket');
    this.region =
      this.configService.get<string>('services.aws.s3.region') || 'us-east-1';
    this.client = new S3Client({ region: this.region });
  }

  async normalizeExternalUrl(
    userId: string,
    rawUrl: string,
    kind: ManagedImageKind,
  ): Promise<ManagedImage> {
    this.requireBucket();
    const ownedKey = this.getOwnedObjectKey(rawUrl);
    if (ownedKey) {
      if (
        ownedKey !== 'images/logo.png' &&
        !ownedKey.startsWith('optimized-images/') &&
        !ownedKey.includes(`/${userId}/`)
      ) {
        throw new BadRequestException('Image does not belong to this user');
      }
      return { fileUrl: rawUrl, objectKey: ownedKey };
    }

    const url = this.validateExternalSource(rawUrl);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      throw new BadRequestException('Could not download image');
    }
    if (!response.ok) {
      throw new BadRequestException(
        `Could not download image (${response.status})`,
      );
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new BadRequestException('URL did not return an image');
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_SOURCE_BYTES) {
      throw new BadRequestException('Image is too large');
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_SOURCE_BYTES) {
      throw new BadRequestException('Image is too large');
    }
    return this.storeBuffer(userId, bytes, kind);
  }

  async storeBuffer(
    userId: string,
    source: Buffer,
    kind: ManagedImageKind,
  ): Promise<ManagedImage> {
    const bucket = this.requireBucket();
    if (source.length > MAX_SOURCE_BYTES) {
      throw new BadRequestException('Image is too large');
    }
    const profile =
      kind === 'flashcard'
        ? { folder: 'flashcard-images', width: 320, height: 240, quality: 76 }
        : { folder: 'book-covers', width: 480, height: 640, quality: 80 };
    let buffer: Buffer;
    try {
      buffer = await sharp(source, {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize({
          width: profile.width,
          height: profile.height,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: profile.quality, effort: 4 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid or unsupported image');
    }

    const hash = createHash('sha256').update(buffer).digest('hex');
    const objectKey = `${profile.folder}/${userId}/${hash}.webp`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return {
      fileUrl: this.publicUrl(objectKey),
      objectKey,
    };
  }

  getOwnedObjectKey(rawUrl: string): string | undefined {
    if (!this.bucket) return undefined;
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return undefined;
    }
    const hostname = url.hostname.toLowerCase();
    const bucket = this.bucket.toLowerCase();
    const isOwned =
      hostname === `${bucket}.s3.amazonaws.com` ||
      (hostname.startsWith(`${bucket}.s3.`) &&
        hostname.endsWith('.amazonaws.com'));
    return isOwned
      ? decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      : undefined;
  }

  private validateExternalSource(rawUrl: string): URL {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Invalid image URL');
    }
    const allowedHosts = new Set(['images.pexels.com', 'images.unsplash.com']);
    if (
      url.protocol !== 'https:' ||
      !allowedHosts.has(url.hostname.toLowerCase())
    ) {
      throw new BadRequestException('Unsupported external image source');
    }
    return url;
  }

  private requireBucket(): string {
    if (!this.bucket) {
      throw new InternalServerErrorException('AWS_S3_BUCKET is not configured');
    }
    return this.bucket;
  }

  private publicUrl(objectKey: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${objectKey}`;
  }
}

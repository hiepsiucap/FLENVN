import { BadRequestException } from '@nestjs/common';
import { ManagedImageService } from './managed-image.service';

describe('ManagedImageService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'services.aws.s3.bucket') return 'flenvn';
      if (key === 'services.aws.s3.region') return 'ap-southeast-1';
      return undefined;
    }),
  };

  const service = new ManagedImageService(config as never);

  it('recognizes an object in the configured bucket', () => {
    expect(
      service.getOwnedObjectKey(
        'https://flenvn.s3.ap-southeast-1.amazonaws.com/flashcard-images/user-1/a.webp',
      ),
    ).toBe('flashcard-images/user-1/a.webp');
  });

  it('rejects an S3 object owned by another user', async () => {
    await expect(
      service.normalizeExternalUrl(
        'user-1',
        'https://flenvn.s3.ap-southeast-1.amazonaws.com/flashcard-images/user-2/a.webp',
        'flashcard',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects untrusted external hosts before fetching them', async () => {
    await expect(
      service.normalizeExternalUrl(
        'user-1',
        'https://example.com/image.jpg',
        'flashcard',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

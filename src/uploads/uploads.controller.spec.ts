import { BadRequestException } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

describe('audio uploads', () => {
  const uploadFile = jest
    .fn()
    .mockResolvedValue({ fileUrl: 'https://cdn.test/audio.mp3' });
  const controller = new UploadsController({
    uploadFile,
  } as unknown as UploadsService);
  const file = {
    buffer: Buffer.from('audio'),
    mimetype: 'audio/mpeg',
    originalname: 'word.mp3',
    size: 5,
  };

  beforeEach(() => uploadFile.mockClear());

  it('stores an audio file in the user folder', async () => {
    await expect(
      controller.uploadAudio({ id: 'user-1' }, file),
    ).resolves.toEqual({ fileUrl: 'https://cdn.test/audio.mp3' });
    expect(uploadFile).toHaveBeenCalledWith(
      'user-1',
      file,
      'audio/flashcards',
      expect.arrayContaining(['audio/mpeg']),
    );
  });

  it('rejects missing and unsupported files', async () => {
    await expect(
      controller.uploadAudio({ id: 'user-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.uploadAudio(
        { id: 'user-1' },
        { ...file, mimetype: 'text/plain' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(uploadFile).not.toHaveBeenCalled();
  });
});

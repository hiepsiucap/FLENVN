import { BadRequestException } from '@nestjs/common';
import { SubmissionsController } from './submissions.controller';

describe('SubmissionsController evidence image presign', () => {
  const uploadsService = {
    createImageUploadUrl: jest.fn(() =>
      Promise.resolve({
        uploadUrl: 'https://upload.example',
        fileUrl: 'https://file.example',
      }),
    ),
  };
  const controller = new SubmissionsController(
    {} as never,
    uploadsService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('presigns an image in the authenticated user evidence folder', async () => {
    await controller.uploadEvidenceImage({ id: 'user-id' } as never, {
      contentType: 'image/png',
      fileName: 'proof.png',
    });
    expect(uploadsService.createImageUploadUrl).toHaveBeenCalledWith(
      'user-id',
      {
        contentType: 'image/png',
        fileName: 'proof.png',
        folder: 'images/submissions',
      },
    );
  });

  it('rejects unsupported evidence content types', async () => {
    await expect(
      controller.uploadEvidenceImage({ id: 'user-id' } as never, {
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(uploadsService.createImageUploadUrl).not.toHaveBeenCalled();
  });
});

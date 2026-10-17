import { SubmissionsService } from './submissions.service';
import { SubmissionStatus, SubmissionType } from './submission.entity';

describe('SubmissionsService', () => {
  const repository = {
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) =>
      Promise.resolve({
        id: 'submission-id',
        ...(value as object),
      }),
    ),
    find: jest.fn(() => Promise.resolve([])),
    findOne: jest.fn(() =>
      Promise.resolve(null as { id: string; status: SubmissionStatus } | null),
    ),
  };
  const service = new SubmissionsService(
    repository as never,
    {
      get: jest.fn((key: string) =>
        key === 'services.aws.s3.bucket' ? 'test-bucket' : 'ap-southeast-1',
      ),
    } as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('stores feedback under the authenticated user', async () => {
    await service.create('user-id', SubmissionType.FEEDBACK, {
      message: 'Helpful app',
      subject: 'Suggestion',
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        type: 'feedback',
        message: 'Helpful app',
        subject: 'Suggestion',
      }),
    );
  });

  it('stores verified evidence image and pending status', async () => {
    await service.create('user-id', SubmissionType.REPORT, {
      message: 'Broken audio',
      evidenceImageUrl:
        'https://test-bucket.s3.ap-southeast-1.amazonaws.com/images/submissions/user-id/screenshot.png',
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SubmissionStatus.PENDING,
        evidenceImageUrl:
          'https://test-bucket.s3.ap-southeast-1.amazonaws.com/images/submissions/user-id/screenshot.png',
      }),
    );
  });

  it('rejects another user image', () => {
    expect(() =>
      service.create('user-id', SubmissionType.REPORT, {
        message: 'Broken audio',
        evidenceImageUrl:
          'https://test-bucket.s3.ap-southeast-1.amazonaws.com/images/submissions/other-id/screenshot.png',
      }),
    ).toThrow();
  });

  it('lists only the signed-in user submissions', async () => {
    await service.findMine('user-id');
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-id' } }),
    );
  });

  it('does not reveal another user submission', async () => {
    repository.findOne.mockResolvedValueOnce(null);
    await expect(
      service.findMineById('user-id', 'submission-id'),
    ).rejects.toThrow('Submission not found');
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'submission-id', userId: 'user-id' },
    });
  });

  it('updates a submission status', async () => {
    repository.findOne.mockResolvedValueOnce({
      id: 'submission-id',
      status: SubmissionStatus.PENDING,
    });
    await service.updateStatus('submission-id', SubmissionStatus.RESOLVED);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'submission-id',
        status: SubmissionStatus.RESOLVED,
      }),
    );
  });

  it('stores reports under the authenticated user', async () => {
    await service.create('user-id', SubmissionType.REPORT, {
      message: 'Audio does not play',
    });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        type: 'report',
        message: 'Audio does not play',
        subject: null,
      }),
    );
  });
});

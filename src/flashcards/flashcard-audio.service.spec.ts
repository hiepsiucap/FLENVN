import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { FlashcardAudioService } from './flashcard-audio.service';

function setup() {
  const polly = jest
    .spyOn(PollyClient.prototype, 'send')
    .mockResolvedValue({ AudioStream: new Uint8Array([1, 2, 3]) } as never);
  const s3 = jest
    .spyOn(S3Client.prototype, 'send')
    .mockResolvedValue({} as never);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  const config = new ConfigService({
    services: {
      aws: {
        region: 'ap-southeast-1',
        polly: { voiceId: 'Salli', engine: 'standard' },
        s3: { bucket: 'test-audio', region: 'ap-southeast-1' },
      },
    },
  });
  return { service: new FlashcardAudioService(config), polly, s3 };
}
describe('Polly recordings', () => {
  afterEach(() => jest.restoreAllMocks());
  it('uses a dialogue voice override and uploads an MP3', async () => {
    const { service, polly, s3 } = setup();
    const url = await service.createAudioUrl('user', 'Hello there.', 'Matthew');
    const speech = polly.mock.calls[0][0] as SynthesizeSpeechCommand;
    expect(speech.input.VoiceId).toBe('Matthew');
    expect(speech.input.Text).toBe('Hello there.');
    expect(speech.input.OutputFormat).toBe('mp3');
    expect(
      (polly.mock.calls[0][1] as { abortSignal: AbortSignal }).abortSignal,
    ).toBeInstanceOf(AbortSignal);
    const upload = s3.mock.calls[0][0] as PutObjectCommand;
    expect(upload.input.ContentType).toBe('audio/mpeg');
    expect(upload.input.Body).toEqual(Buffer.from([1, 2, 3]));
    expect(
      (s3.mock.calls[0][1] as { abortSignal: AbortSignal }).abortSignal,
    ).toBeInstanceOf(AbortSignal);
    expect(url).toMatch(
      /^https:\/\/test-audio.s3.ap-southeast-1.amazonaws.com\/audio\/flashcards\/user\/.+\.mp3$/,
    );
  });
  it('keeps the configured voice for existing callers and accepts streamed audio', async () => {
    const { service, polly, s3 } = setup();
    polly.mockResolvedValue({
      AudioStream: Readable.from([Buffer.from('audio')]),
    } as never);
    await service.createAudioUrl('user', 'Hello.');
    expect(
      (polly.mock.calls[0][0] as SynthesizeSpeechCommand).input.VoiceId,
    ).toBe('Salli');
    expect((s3.mock.calls[0][0] as PutObjectCommand).input.Body).toEqual(
      Buffer.from('audio'),
    );
  });
  it('does not upload failed synthesis and does not return a URL after failed upload', async () => {
    const { service, polly, s3 } = setup();
    polly.mockRejectedValueOnce(new Error('Unavailable') as never);
    await expect(
      service.createAudioUrl('user', 'Hello.'),
    ).resolves.toBeUndefined();
    expect(s3).not.toHaveBeenCalled();
    s3.mockRejectedValueOnce(new Error('Upload failed') as never);
    await expect(
      service.createAudioUrl('user', 'Hello.'),
    ).resolves.toBeUndefined();
  });
});

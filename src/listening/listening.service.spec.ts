import { ListeningService } from './listening.service';
import { validateListeningContent } from './listening-content';
import { ListeningSet } from './listening-set.entity';
const dto = {
  flashcardIds: ['card'],
  game: 'catch-details' as const,
  difficulty: 'easy' as const,
};
function questions() {
  return validateListeningContent(
    Array.from({ length: 5 }, () => ({
      prompt: 'When is the apple delivery?',
      script: [{ speaker: 'A', text: 'Your apple delivery is on Friday.' }],
      acceptedAnswers: ['Friday'],
      evidence: 'Friday',
      explanation: 'Giao hàng vào thứ Sáu.',
    })),
    'catch-details',
    ['apple'],
  );
}
function setup() {
  const rows: ListeningSet[] = [];
  const cards = {
    findOne: jest.fn().mockResolvedValue({
      id: 'card',
      userId: 'user',
      word: 'apple',
      example: 'I eat an apple.',
      exampleAudioUrl: null,
    }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([{ id: 'card', word: 'apple' }]),
  };
  const sets = {
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: Partial<ListeningSet> }) =>
        Promise.resolve(
          rows.find((row) =>
            Object.entries(where).every(
              ([key, value]) => row[key as keyof ListeningSet] === value,
            ),
          ) ?? null,
        ),
      ),
    create: jest.fn().mockImplementation((data: Partial<ListeningSet>) => ({
      id: 'set',
      updatedAt: new Date(),
      ...data,
    })),
    save: jest.fn().mockImplementation((row: ListeningSet) => {
      if (!rows.includes(row)) rows.push(row);
      return Promise.resolve(row);
    }),
  };
  const model = {
    generate: jest.fn().mockImplementation(() => Promise.resolve(questions())),
  };
  const audio = {
    createAudioUrl: jest
      .fn()
      .mockResolvedValue('https://audio.example/test.mp3'),
  };
  const service = new ListeningService(
    cards as never,
    sets as never,
    model as never,
    audio as never,
  );
  return { rows, cards, sets, model, audio, service };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
describe('listening rounds', () => {
  it('checks ownership before making AI or Polly requests', async () => {
    const { service, cards, model, audio } = setup();
    cards.find.mockResolvedValue([]);
    await expect(service.generate('user', dto)).rejects.toThrow();
    expect(model.generate).not.toHaveBeenCalled();
    expect(audio.createAudioUrl).not.toHaveBeenCalled();
  });
  it('generates once, reuses saved audio, and never exposes keys or transcripts before answering', async () => {
    const { service, model, audio } = setup();
    await service.generate('user', dto);
    await flush();
    const ready = await service.generate('user', dto);
    expect(model.generate).toHaveBeenCalledTimes(1);
    expect(audio.createAudioUrl).toHaveBeenCalledTimes(5);
    expect(ready).toMatchObject({
      id: 'set',
      status: 'ready',
      questions: [
        expect.objectContaining({
          id: 'q1',
          audioUrls: ['https://audio.example/test.mp3'],
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      ],
    });
    const json = JSON.stringify(ready);
    expect(json).not.toContain('Friday');
    expect(json).not.toContain('acceptedAnswers');
    expect(json).not.toContain('script');
  });
  it('grades on the server and reveals only the answered question', async () => {
    const { service } = setup();
    await service.generate('user', dto);
    await flush();
    await expect(
      service.answer('user', 'set', { questionId: 'q1', answer: 'friday.' }),
    ).resolves.toMatchObject({
      correct: true,
      score: 100,
      correctAnswer: 'Friday',
    });
    await expect(
      service.answer('other', 'set', { questionId: 'q1', answer: 'Friday' }),
    ).rejects.toThrow();
    await expect(service.get('other', 'set')).rejects.toThrow();
    await expect(
      service.answer('user', 'set', {
        questionId: 'missing',
        answer: 'Friday',
      }),
    ).rejects.toThrow();
  });
  it('reports audio failure without publishing a partially ready set and allows retry', async () => {
    const { service, audio, model } = setup();
    audio.createAudioUrl.mockResolvedValue(undefined);
    await service.generate('user', dto);
    await flush();
    await expect(service.get('user', 'set')).resolves.toMatchObject({
      status: 'failed',
      questions: [],
    });
    audio.createAudioUrl.mockResolvedValue('https://audio.example/test.mp3');
    await service.generate('user', dto);
    await flush();
    expect(model.generate).toHaveBeenCalledTimes(2);
    await expect(service.get('user', 'set')).resolves.toMatchObject({
      status: 'ready',
    });
  });
  it('shares an in-progress set and cannot grade it early', async () => {
    const { service, model } = setup();
    let release!: (value: ReturnType<typeof questions>) => void;
    model.generate.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    await service.generate('user', dto);
    await service.generate('user', dto);
    expect(model.generate).toHaveBeenCalledTimes(1);
    await expect(
      service.answer('user', 'set', { questionId: 'q1', answer: 'Friday' }),
    ).rejects.toThrow();
    release(questions());
    await flush();
  });
  it('rebuilds a stuck generation after restart', async () => {
    const { service, rows, model } = setup();
    await service.generate('user', dto);
    await flush();
    rows[0].status = 'generating';
    rows[0].updatedAt = new Date(Date.now() - 300_000);
    await service.generate('user', dto);
    await flush();
    expect(model.generate).toHaveBeenCalledTimes(2);
  });
});

describe('saved sentence audio', () => {
  it('reuses an existing sentence recording without Polly', async () => {
    const { service, cards, audio } = setup();
    cards.findOne.mockResolvedValue({
      id: 'card',
      userId: 'user',
      word: 'apple',
      example: 'I eat an apple.',
      exampleAudioUrl: 'https://audio.example/sentence.mp3',
    });
    await expect(service.sentenceAudio('user', 'card')).resolves.toEqual({
      url: 'https://audio.example/sentence.mp3',
    });
    expect(audio.createAudioUrl).not.toHaveBeenCalled();
  });
  it('generates the full sentence and saves its URL with an example guard', async () => {
    const { service, cards, audio } = setup();
    await service.sentenceAudio('user', 'card');
    expect(audio.createAudioUrl).toHaveBeenCalledWith(
      'user',
      'I eat an apple.',
    );
    expect(cards.update).toHaveBeenCalledWith(
      { id: 'card', userId: 'user', example: 'I eat an apple.' },
      { exampleAudioUrl: 'https://audio.example/test.mp3' },
    );
  });
  it('does not synthesize another user’s card or report a failed upload as success', async () => {
    const { service, cards, audio } = setup();
    cards.findOne.mockResolvedValue(null as never);
    await expect(service.sentenceAudio('other', 'card')).rejects.toThrow();
    expect(audio.createAudioUrl).not.toHaveBeenCalled();
    cards.findOne.mockResolvedValue({
      id: 'card',
      userId: 'user',
      word: 'apple',
      example: 'I eat an apple.',
      exampleAudioUrl: null,
    });
    audio.createAudioUrl.mockResolvedValue(undefined);
    await expect(service.sentenceAudio('user', 'card')).rejects.toThrow();
    expect(cards.update).not.toHaveBeenCalled();
  });
});

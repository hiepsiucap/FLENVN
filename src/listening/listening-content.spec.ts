import {
  checkListeningAnswer,
  validateListeningContent,
} from './listening-content';

const detail = () => ({
  prompt: 'What time is the apple delivery?',
  script: [{ speaker: 'A', text: 'Your apple delivery arrives at 3:30 pm.' }],
  acceptedAnswers: ['3:30 pm', '15:30'],
  evidence: '3:30 pm',
  explanation: 'Người nói xác nhận giao hàng lúc 3:30 chiều.',
});
const batch = () =>
  Array.from({ length: 5 }, (_, i) => ({
    ...detail(),
    prompt: `${detail().prompt} (${i + 1})`,
  }));
const choices = () => ({
  ...detail(),
  prompt: 'When will the apple delivery arrive?',
  choices: ['This afternoon.', 'At the station.', 'By truck.'],
  answerIndex: 0,
  acceptedAnswers: undefined,
});

describe('listening question validation and scoring', () => {
  it('accepts five grounded questions and assigns server IDs', () => {
    const questions = validateListeningContent(batch(), 'catch-details', [
      'apple',
    ]);
    expect(questions).toHaveLength(5);
    expect(questions[0].id).toBe('q1');
    expect(questions[0].audioUrls).toEqual([]);
  });
  it('rejects incomplete sets, oversized audio text and missing vocabulary', () => {
    expect(() =>
      validateListeningContent([detail()], 'catch-details', ['apple']),
    ).toThrow();
    expect(() =>
      validateListeningContent(
        batch().map((q) => ({
          ...q,
          script: [{ speaker: 'A', text: 'apple '.repeat(200) }],
        })),
        'catch-details',
        ['apple'],
      ),
    ).toThrow();
    expect(() =>
      validateListeningContent(batch(), 'catch-details', ['banana']),
    ).toThrow();
  });
  it('rejects answers and evidence absent from the script', () => {
    expect(() =>
      validateListeningContent(
        batch().map((q) => ({ ...q, acceptedAnswers: ['Tuesday'] })),
        'catch-details',
        ['apple'],
      ),
    ).toThrow();
    expect(() =>
      validateListeningContent(
        batch().map((q) => ({ ...q, evidence: 'Tuesday' })),
        'catch-details',
        ['apple'],
      ),
    ).toThrow();
  });
  it('rejects duplicate choices and invalid keys', () => {
    expect(() =>
      validateListeningContent(
        batch().map((q) => ({
          ...q,
          ...choices(),
          choices: ['Yes', ' yes ', 'No'],
        })),
        'quick-reply',
        ['apple'],
      ),
    ).toThrow();
    expect(() =>
      validateListeningContent(
        batch().map((q) => ({ ...q, ...choices(), answerIndex: 4 })),
        'quick-reply',
        ['apple'],
      ),
    ).toThrow();
  });
  it('requires both speakers for conversations', () => {
    expect(() =>
      validateListeningContent(
        batch().map((q) => ({ ...q, ...choices() })),
        'conversation',
        ['apple'],
      ),
    ).toThrow();
    const data = batch().map((q) => ({
      ...q,
      ...choices(),
      script: [
        ...q.script,
        { speaker: 'B', text: 'Thank you for confirming.' },
      ],
    }));
    expect(
      validateListeningContent(data, 'conversation', ['apple']),
    ).toHaveLength(5);
  });
  it('accepts declared short-answer alternatives, ignoring punctuation and case', () => {
    const question = validateListeningContent(batch(), 'catch-details', [
      'apple',
    ])[0];
    expect(checkListeningAnswer(question, ' 3:30 PM. ')).toBe(true);
    expect(checkListeningAnswer(question, '15:30')).toBe(true);
    expect(checkListeningAnswer(question, '3:30 am')).toBe(false);
    expect(checkListeningAnswer(question, '')).toBe(false);
  });
  it('grades choice indexes instead of trusting client correctness', () => {
    const question = validateListeningContent(
      batch().map((q) => ({ ...q, ...choices() })),
      'quick-reply',
      ['apple'],
    )[0];
    expect(checkListeningAnswer(question, '0')).toBe(true);
    expect(checkListeningAnswer(question, '1')).toBe(false);
    expect(checkListeningAnswer(question, 'This afternoon.')).toBe(false);
  });
});

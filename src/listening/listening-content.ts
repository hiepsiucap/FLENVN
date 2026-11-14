export type ListeningGame = 'quick-reply' | 'catch-details' | 'conversation';
export type ListeningQuestion = {
  id: string;
  prompt: string;
  script: { speaker: 'A' | 'B'; text: string }[];
  choices?: string[];
  answerIndex?: number;
  acceptedAnswers?: string[];
  evidence: string;
  explanation: string;
  audioUrls: string[];
};
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('Invalid listening text');
  return value.trim();
}
function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function contains(source: string, phrase: string) {
  return ` ${normalize(source)} `.includes(` ${normalize(phrase)} `);
}
export function validateListeningContent(
  input: unknown,
  game: ListeningGame,
  words: string[],
): ListeningQuestion[] {
  if (!Array.isArray(input) || input.length !== 5)
    throw new Error('Expected five questions');
  return input.map((value: unknown, index) => {
    if (!value || typeof value !== 'object')
      throw new Error('Invalid question');
    const item = value as Record<string, unknown>;
    const prompt = text(item.prompt, 240);
    const explanation = text(item.explanation, 1200);
    const evidence = text(item.evidence, 300);
    if (
      !Array.isArray(item.script) ||
      item.script.length < 1 ||
      item.script.length > 4
    )
      throw new Error('Invalid script');
    const script = item.script.map((turn: unknown) => {
      if (!turn || typeof turn !== 'object') throw new Error('Invalid turn');
      const record = turn as Record<string, unknown>;
      if (record.speaker !== 'A' && record.speaker !== 'B')
        throw new Error('Invalid speaker');
      return {
        speaker: record.speaker,
        text: text(record.text, 600),
      } as ListeningQuestion['script'][number];
    });
    const spoken = script.map((turn) => turn.text).join(' ');
    if (
      spoken.length > 1000 ||
      !contains(spoken, evidence) ||
      !words.some((word) => contains(spoken, word))
    )
      throw new Error('Ungrounded listening content');
    if (
      game === 'conversation' &&
      new Set(script.map((turn) => turn.speaker)).size !== 2
    )
      throw new Error('Conversation needs two speakers');
    if (game !== 'conversation' && script.length !== 1)
      throw new Error('Expected a single recording');
    const result: ListeningQuestion = {
      id: `q${index + 1}`,
      prompt,
      script,
      evidence,
      explanation,
      audioUrls: [],
    };
    if (game === 'catch-details') {
      if (
        !Array.isArray(item.acceptedAnswers) ||
        !item.acceptedAnswers.length ||
        item.acceptedAnswers.length > 5
      )
        throw new Error('Invalid answers');
      result.acceptedAnswers = item.acceptedAnswers.map((answer) =>
        text(answer, 120),
      );
      if (!contains(spoken, result.acceptedAnswers[0]))
        throw new Error('Answer missing from audio');
    } else {
      if (!Array.isArray(item.choices) || item.choices.length !== 3)
        throw new Error('Expected three choices');
      result.choices = item.choices.map((choice) => text(choice, 200));
      if (
        new Set(result.choices.map(normalize)).size !== 3 ||
        !Number.isInteger(item.answerIndex) ||
        Number(item.answerIndex) < 0 ||
        Number(item.answerIndex) >= 3
      )
        throw new Error('Invalid choice key');
      result.answerIndex = Number(item.answerIndex);
    }
    return result;
  });
}
export function checkListeningAnswer(
  question: ListeningQuestion,
  answer: string,
): boolean {
  if (question.choices) return answer === String(question.answerIndex);
  return (
    Boolean(normalize(answer)) &&
    Boolean(
      question.acceptedAnswers?.some(
        (expected) => normalize(expected) === normalize(answer),
      ),
    )
  );
}

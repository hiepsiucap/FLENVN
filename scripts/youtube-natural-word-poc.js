require('dotenv').config({ quiet: true });

const { fetchTranscript } = require('youtube-transcript');

const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const EDUCATIONAL_TERMS = [
  'definition',
  'dictionary',
  'learn english',
  'pronunciation',
  'vocabulary',
  'word of the day',
  'what does',
  'meaning of',
  'how to use',
];
const NATURAL_TERMS = [
  'conversation',
  'interview',
  'podcast',
  'scene',
  'story',
  'speech',
  'documentary',
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(value) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function toSeconds(milliseconds) {
  return Math.round((milliseconds / 1000) * 1000) / 1000;
}

function containsAny(value, terms) {
  const normalized = normalize(value);
  return terms.some((term) => normalized.includes(term));
}

async function youtubeRequest(path, params) {
  const url = new URL(`${API_BASE_URL}/${path}`);
  Object.entries({ ...params, key: process.env.YOUTUBE_API_KEY }).forEach(
    ([key, value]) => url.searchParams.set(key, String(value)),
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube ${path} failed with HTTP ${response.status}`);
  }
  return response.json();
}

async function searchCandidates(word, maxResults) {
  const queries = [
    `"${word}" conversation OR interview`,
    `"${word}" podcast OR story`,
    `"${word}" scene OR documentary`,
  ];
  const results = await Promise.all(
    queries.map((query) =>
      youtubeRequest('search', {
        part: 'snippet',
        q: query,
        type: 'video',
        videoCaption: 'closedCaption',
        videoEmbeddable: true,
        relevanceLanguage: 'en',
        safeSearch: 'strict',
        maxResults,
      }),
    ),
  );

  const candidates = new Map();
  results.flatMap((result) => result.items || []).forEach((item) => {
    candidates.set(item.id.videoId, {
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelTitle: item.snippet.channelTitle,
    });
  });
  return [...candidates.values()];
}

function findMatches(transcript, word) {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  const naturalPattern = new RegExp(
    `\\b(with|in|for|of|under)\\s+${escapeRegExp(word)}\\b|\\b${escapeRegExp(word)}\\s+(for|toward|towards|of)\\b`,
    'i',
  );
  const explanationPattern = new RegExp(
    `\\b${escapeRegExp(word)}\\s+(is|means|refers)|\\b(called|use|define|definition of|meaning of)\\s+${escapeRegExp(word)}\\b`,
    'i',
  );
  const properTitlePattern = new RegExp(
    `\\b(plot|novel|book|film|movie|episode|title|story)\\b.{0,30}\\b${escapeRegExp(word)}\\b|\\b${escapeRegExp(word)}\\b.{0,30}\\b(plot|novel|book|film|movie|episode|title)\\b`,
    'i',
  );
  return transcript.flatMap((line, index) => {
    if (!pattern.test(line.text)) return [];

    const context = transcript.slice(
      Math.max(0, index - 1),
      Math.min(transcript.length, index + 2),
    );
    const contextText = normalize(context.map((item) => item.text).join(' '));
    const first = context[0];
    const last = context[context.length - 1];
    const wordCount = contextText.split(' ').length;
    let score = 50;

    if (wordCount >= 8 && wordCount <= 45) score += 20;
    if (/[.!?]/.test(contextText)) score += 5;
    if (containsAny(contextText, NATURAL_TERMS)) score += 5;
    if (containsAny(contextText, EDUCATIONAL_TERMS)) score -= 35;
    if (naturalPattern.test(contextText)) score += 30;
    if (explanationPattern.test(contextText)) score -= 35;
    if (properTitlePattern.test(contextText)) score -= 45;
    if ((last.offset + last.duration - first.offset) / 1000 <= 15) score += 10;
    if (normalize(line.text).startsWith(word.toLowerCase())) score -= 5;

    return [
      {
        text: line.text.replace(/\s+/g, ' ').trim(),
        context: contextText,
        startSeconds: toSeconds(first.offset),
        endSeconds: toSeconds(last.offset + last.duration),
        naturalScore: score,
      },
    ];
  });
}

async function evaluateCandidate(candidate, word) {
  const metadata = `${candidate.title} ${candidate.description}`;
  if (containsAny(metadata, EDUCATIONAL_TERMS)) return null;

  try {
    const transcript = await fetchTranscript(candidate.videoId, { lang: 'en' });
    const matches = findMatches(transcript, word);
    if (matches.length === 0) return null;

    const titleContainsWord = normalize(candidate.title).includes(
      word.toLowerCase(),
    );
    const metadataBonus = containsAny(metadata, NATURAL_TERMS) ? 10 : 0;
    const titlePenalty = titleContainsWord ? 35 : 0;
    const bestMatch = matches
      .map((match) => ({
        ...match,
        naturalScore: match.naturalScore + metadataBonus - titlePenalty,
      }))
      .sort((a, b) => b.naturalScore - a.naturalScore)[0];

    return {
      videoId: candidate.videoId,
      title: candidate.title,
      channelTitle: candidate.channelTitle,
      url: `https://www.youtube.com/watch?v=${candidate.videoId}&t=${Math.floor(bestMatch.startSeconds)}s`,
      ...bestMatch,
    };
  } catch {
    return null;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

async function main() {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY is missing from .env');
  }
  const word = process.argv[2] || 'contempt';
  const resultsPerQuery = Number(process.argv[3] || 8);
  const candidates = await searchCandidates(word, resultsPerQuery);
  const evaluated = await mapWithConcurrency(candidates, 3, (candidate) =>
    evaluateCandidate(candidate, word),
  );
  const matches = evaluated
    .filter(Boolean)
    .sort((a, b) => b.naturalScore - a.naturalScore)
    .slice(0, 5);

  process.stdout.write(
    `${JSON.stringify(
      {
        success: true,
        word,
        candidateCount: candidates.length,
        usableMatchCount: matches.length,
        matches,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    )}\n`,
  );
  process.exitCode = 1;
});

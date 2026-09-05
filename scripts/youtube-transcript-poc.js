const { fetchTranscript } = require('youtube-transcript');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function seconds(value) {
  return Math.round((value / 1000) * 1000) / 1000;
}

async function main() {
  const videoId = process.argv[2] || 'k2h8PvLY6D4';
  const word = process.argv[3] || 'contempt';
  const language = process.argv[4] || 'en';
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');

  const transcript = await fetchTranscript(videoId, { lang: language });
  const matches = transcript.flatMap((line, index) => {
    if (!pattern.test(line.text)) return [];

    const contextStart = Math.max(0, index - 1);
    const contextEnd = Math.min(transcript.length - 1, index + 1);
    const context = transcript.slice(contextStart, contextEnd + 1);
    const first = context[0];
    const last = context[context.length - 1];

    return [
      {
        text: line.text,
        context: context.map((item) => item.text).join(' '),
        startSeconds: seconds(first.offset),
        endSeconds: seconds(last.offset + last.duration),
      },
    ];
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        success: true,
        videoId,
        word,
        language,
        transcriptLineCount: transcript.length,
        matchCount: matches.length,
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

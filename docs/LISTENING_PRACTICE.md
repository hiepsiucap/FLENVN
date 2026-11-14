# Listening practice

This feature provides Quick reply, Catch the details, and Conversation challenge. These use original generated English scripts, Vietnamese explanations, and Polly recordings. No image generation is involved. Scores are local round accuracy; they do not update XP or spaced repetition and do not predict exam scores.

## Data flow

1. Review's game picker opens Listening games with the selected flashcards (1–20).
2. `POST /api/v1/listening/sets` accepts `flashcardIds`, `game` (`quick-reply`, `catch-details`, `conversation`), and `difficulty` (`easy`, `medium`, `hard`). All cards must belong to the authenticated user. A request creates or reuses a saved set; the response is `generating`, `ready`, or `failed`.
3. The frontend polls `GET /api/v1/listening/sets/:id` every 1.5 seconds, up to three minutes. Closing the screen aborts polling. Backend generation can finish and be reused later. Generation requests are limited to three per minute by the application's throttler.
4. Vertex generates exactly five questions. Validation checks counts, field lengths, choices, answer indexes, evidence in the script, vocabulary presence, primary short-answer grounding, and two-speaker conversation structure before making Polly calls. Structural checks do not prove that an AI question is semantically unambiguous; human review of live generated examples remains necessary.
5. Polly synthesizes each script turn, with Joanna for A and Matthew for B, and stores MP3s in the existing S3 bucket. Dialogue turns play sequentially. AWS calls have timeouts. A set is marked ready only after every recording succeeds.
6. `POST /api/v1/listening/sets/:id/answers` accepts `questionId` and `answer`. Choice answers are zero-based index strings. Short answers are compared with model-provided accepted alternatives, ignoring case, punctuation, and extra whitespace. Grading runs on the server and returns only that question's transcript, correct answer, and explanation.

Public set responses never include transcripts, evidence, explanations, accepted answers, or answer indexes. All set reads and answers check ownership. Failed generations can be explicitly retried. A generation left pending by a process restart can be retried after three minutes. Same-process duplicate requests share the pending generation; a unique `(userId, cacheKey)` constraint also protects initial cross-process insertion. Failed/stale job retries are intended for the current single-instance deployment; multiple worker instances would need an atomic database job claim.

The cache key includes the selected card IDs and words, game, difficulty, and content schema version. Changing vocabulary or these settings creates a new set. Repeated requests with the same inputs reuse the saved questions and audio. There is no automatic paid regeneration on replay. Partially uploaded audio from a failed generation can remain in S3; the current feature does not implement orphan-file cleanup.

## Speaking audio

Say it still scores recognized words from full example sentences, not pronunciation. Listen now uses `exampleAudioUrl` when present. Otherwise `POST /api/v1/listening/sets/sentence-audio` accepts `flashcardId`, verifies ownership, creates sentence audio through the existing Polly service, and saves its URL on that flashcard. Concurrent requests in one process share generation. An update predicate checks that the example hasn't changed during synthesis. The frontend caches generated audio for the round and aborts outstanding requests/playback on exit. Browser speech recognition remains browser-dependent; no live microphone check was performed in the automated suite.

## Release requirements

- Apply `1723280000000-CreateListeningSets` before the new frontend calls these endpoints. The backend's production configuration already enables migrations on startup.
- Existing Vertex project/credentials and Polly/S3 configuration are reused; no new AI provider is required.
- The deployed role must allow Polly synthesis and uploads to the configured bucket. MP3 URLs need to be playable by the browser, following the existing flashcard-audio policy.
- Confirm the configured Polly engine supports the Joanna and Matthew voices in the configured region.
- Deploy the backend and migration before deploying the frontend.

## Validation

Backend:

```sh
npx jest --runInBand
npx eslint src/listening src/flashcards/flashcard-audio.service.ts src/flashcards/flashcard-audio.service.spec.ts src/database/migrations/1723280000000-CreateListeningSets.ts
npm run build
```

The disposable database integration script runs real Nest HTTP controllers, validation pipes, response envelopes, and a real PostgreSQL repository. It mocks the JWT identity boundary, flashcard reads, Vertex, and Polly/S3. It checks migration up/down, input limits, unauthorized and cross-user access, persistence, reuse, server grading, and user-deletion cascade. It must only target its isolated test database. Example:

```sh
docker run --rm -d --name flenvn-listening-validation -e POSTGRES_PASSWORD=listening-local-test -e POSTGRES_DB=listening_validation -p 127.0.0.1::5432 postgres:15
docker port flenvn-listening-validation 5432/tcp
# Use the allocated local port:
LISTENING_TEST_DATABASE=disposable LISTENING_TEST_PG_PORT=<port> node scripts/tests/listening-integration.cjs
docker stop flenvn-listening-validation
```

Frontend (`web-flenvn`, with its dev server running):

```sh
npx vitest run --exclude '**/.worktrees/**'
npx tsc --noEmit
node scripts/tests/listening.cjs
```

The browser suite mocks API, audio playback, and speech-recognition boundaries. It covers all three listening games at 1280, 390, and 320 pixels; answer concealment, ordered dialogue playback, slower speed, one complete challenge playback, generation/answer retries, audio failure, cancellation, summaries, and saved/generated Polly sentence-audio paths for speaking.

Live provider validation was attempted locally but could not run: the AWS CLI session had expired (`aws login` required), and the local environment had no Vertex project/credentials. No paid AI or Polly generation succeeded during this validation. Before release, use authenticated runtime credentials to generate and listen to one real round for each game, check Vietnamese explanations and answer ambiguity, verify S3 MP3 playback on a real device, and test microphone permission/recognition with actual speech.

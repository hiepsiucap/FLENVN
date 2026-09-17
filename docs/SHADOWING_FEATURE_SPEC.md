# Shadowing Feature Specification

## 1. Summary

The shadowing feature lets a signed-in learner paste a YouTube video link and receive a sequence of short, timestamped transcript segments. The learner can replay one segment at a time, listen, repeat it aloud, and move through the video at a comfortable pace.

## 2. Goals

- Accept a YouTube video link supplied by the user.
- Retrieve the video's title and transcript.
- Divide the transcript into short, natural practice segments.
- Preserve timestamps so each segment can be replayed from the source video.
- Return a stable API response suitable for a mobile or web shadowing player.
- Give the user clear feedback when a video or transcript cannot be used.

## 3. Non-goals for the MVP

- Downloading or storing YouTube video or audio.
- Supporting arbitrary websites, podcasts, or uploaded media.
- Translating the transcript.
- Generating text-to-speech audio.
- Recording, scoring, or grading the learner's speech.
- Saving shadowing sessions or progress.
- Editing transcript text manually.

These capabilities can be considered after the link-to-segments workflow is reliable.

## 4. Primary user story

As an English learner, I want to paste a YouTube link and receive short transcript segments so that I can listen to and repeat each part of the video without manually finding sentence boundaries.

## 5. User flow

1. The signed-in user opens the shadowing screen.
2. The user pastes a YouTube URL.
3. The user may choose a caption language. English is selected by default.
4. The client submits the URL to the preparation endpoint.
5. The server validates the URL and loads the title and transcript.
6. The server divides the transcript into short, timestamped segments.
7. The client displays the video title and the first segment.
8. The learner plays the segment, repeats it, and moves backward or forward between segments.

## 6. Supported links

The MVP supports HTTPS links in these YouTube formats:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/live/VIDEO_ID`
- Equivalent mobile and YouTube Music URLs.

The extracted video ID must contain exactly 11 valid YouTube ID characters. Redirecting URLs and URLs from other domains are rejected.

## 7. Functional requirements

### 7.1 Link input

- The URL is required.
- The URL must use HTTPS.
- The URL must belong to an explicitly supported YouTube hostname.
- The maximum accepted URL length is 500 characters.
- Invalid input returns HTTP `400` and does not call YouTube.

### 7.2 Video title

- The server retrieves the canonical video title from YouTube.
- The title is returned as plain text with surrounding whitespace removed.
- Failure to retrieve required video metadata returns HTTP `502`.

### 7.3 Transcript

- The default requested language is `en`.
- A client may provide another caption language code of up to 10 characters.
- Transcript cues are retrieved through Supadata using the server-side API key.
- Regional language codes such as `en-GB` are normalized to their ISO 639-1 base code (`en`) for Supadata.
- If the requested language is unavailable, Supadata may return the first available transcript language; the actual language is returned in the response.
- Empty, disabled, or unavailable captions return HTTP `404`.
- Transcript markup and redundant whitespace are removed before segmentation.

### 7.4 Segmentation

Each output segment must contain:

- A sequential numeric ID starting at 1.
- Clean transcript text.
- A start timestamp in seconds.
- An end timestamp in seconds.
- A duration in seconds.

Segmentation rules:

1. Combine consecutive caption cues until terminal punctuation (`.`, `!`, or `?`) is reached or the word limit is reached.
2. Default to a maximum of 12 words per segment.
3. Allow the client to request a limit from 3 through 20 words.
4. Split captions longer than the limit into multiple segments.
5. Keep segments in chronological order.
6. Never return empty segments.
7. Round timestamp values to milliseconds.
8. When a caption must be divided without word-level timing, estimate the divided timestamps proportionally. These timestamps are approximate.

The word limit is a safety limit, not a guarantee that every segment is a grammatically complete sentence. YouTube captions may lack punctuation or word-level timing.

## 8. API contract

### Prepare a video

`POST /api/v1/shadowing/prepare`

Authentication: JWT bearer token required.

Request:

```json
{
  "url": "https://www.youtube.com/watch?v=k2h8PvLY6D4",
  "language": "en",
  "maxWordsPerSentence": 12
}
```

Successful response: HTTP `200`

```json
{
  "videoId": "k2h8PvLY6D4",
  "url": "https://www.youtube.com/watch?v=k2h8PvLY6D4",
  "title": "Example video title",
  "language": "en",
  "transcriptSource": "supadata",
  "sentenceCount": 2,
  "sentences": [
    {
      "id": 1,
      "text": "This is a short practice sentence.",
      "startSeconds": 0,
      "endSeconds": 2.4,
      "durationSeconds": 2.4
    },
    {
      "id": 2,
      "text": "Listen carefully and repeat it.",
      "startSeconds": 2.4,
      "endSeconds": 5.1,
      "durationSeconds": 2.7
    }
  ]
}
```

### Error behavior

| Status | Condition                                           | User-facing meaning                        |
| ------ | --------------------------------------------------- | ------------------------------------------ |
| `400`  | Missing, malformed, unsupported, or non-YouTube URL | Enter a valid YouTube video link.          |
| `401`  | Missing or invalid JWT                              | Sign in to use shadowing.                  |
| `404`  | Transcript is empty, disabled, or unavailable       | This video does not have usable captions.  |
| `429`  | Application or upstream rate limit reached          | Wait briefly and try again.                |
| `502`  | YouTube metadata or Supadata fails unexpectedly     | The video could not be loaded right now.   |
| `503`  | `SUPADATA_API_KEY` is not configured                | The transcript provider is not configured. |

Errors follow the application's existing global error response format.

## 9. Frontend requirements

The MVP screen should contain:

- A YouTube URL field.
- A caption-language selector or an English default.
- A prepare button with a loading state.
- The returned video title.
- An embedded YouTube player.
- The current sentence and its position, such as `3 of 24`.
- Replay, previous, and next controls.
- A clear error state for unsupported links and missing captions.

Playback behavior:

- Selecting a sentence seeks to `startSeconds`.
- Playback pauses at or shortly after `endSeconds`.
- Replay seeks back to `startSeconds`.
- Moving next or previous updates both the displayed text and playback range.

## 10. Security and reliability

- Never fetch a user-provided URL directly.
- Extract and validate the video ID, then construct known YouTube URLs server-side.
- Use fixed YouTube oEmbed and Supadata API hosts to prevent server-side request forgery.
- Keep `SUPADATA_API_KEY` in the deployment secret store and never return or log it.
- Apply request timeouts to external calls.
- Do not expose upstream error bodies or secrets to clients.
- Do not store video/audio files in the MVP.
- Do not log bearer tokens or complete upstream responses.
- Apply the application's normal authenticated-user rate limit.

## 11. Performance targets

- A normal preparation request should complete within 15 seconds under typical upstream conditions.
- External requests should use bounded timeouts (8 seconds for title, 15 seconds for transcript by default).
- Title and transcript requests should run concurrently.
- The API should avoid returning duplicate transcript representations.

## 12. Acceptance criteria

- A signed-in user can submit each supported YouTube URL format.
- The response contains the correct video ID, canonical URL, and title.
- A transcript with punctuation is divided at natural sentence endings.
- A long caption without punctuation is divided at the configured word limit.
- No returned segment exceeds the configured word limit.
- Every segment has ordered, non-negative timestamps and `endSeconds >= startSeconds`.
- Segment IDs are sequential and `sentenceCount` matches the array length.
- Invalid and non-YouTube links return `400` without an upstream request.
- A video without usable captions returns `404`.
- Unexpected YouTube or Supadata failures return `502`.
- The endpoint is unavailable without valid authentication.
- Unit tests cover URL extraction, title retrieval, segmentation, long-caption splitting, transcript absence, and upstream failures.

## 13. Future phases

Possible follow-up work:

- Save videos and learning progress.
- Add transcript translation and vocabulary lookup.
- Record the learner and compare speech with the target sentence.
- Add pronunciation and fluency scores.
- Let learners adjust playback speed and repeat count.
- Support uploaded audio/video and additional providers.
- Improve sentence boundaries using NLP while retaining exact timestamps.

## 14. Open product decisions

Before extending beyond the MVP, decide:

- Whether prepared videos and progress should be persisted.
- Whether the initial UI needs translation alongside each sentence.
- Whether auto-generated YouTube captions are acceptable or only human captions should be used.
- Whether Shorts and YouTube Music should remain supported in the UI.
- Whether the default 12-word segment length is comfortable for target learners.

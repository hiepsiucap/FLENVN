# Practice Vocabulary By Book - FE Integration Proposal

## Summary

Backend supports a practice flow where the user can:

1. See their books with the number of vocabulary cards due for review.
2. Choose one book.
3. Choose how many due vocabulary cards to practice.
4. Fetch exactly that number of due flashcards from the selected book.
5. Record each answer and update the flashcard review schedule.

All endpoints require authentication unless noted otherwise.

## 1. Get Books With Due Review Count

```http
GET /api/v1/books/review/due
Authorization: Bearer <access_token>
```

Purpose:

Fetch all books for the current user and include how many vocabulary cards need review today for each book.

Response:

```json
{
  "books": [
    {
      "bookId": "uuid",
      "title": "English Book 1",
      "totalCards": 30,
      "dueForReview": 8
    },
    {
      "bookId": "uuid",
      "title": "Business Vocabulary",
      "totalCards": 20,
      "dueForReview": 0
    }
  ],
  "totalDueForReview": 8
}
```

FE usage:

- Show the list of books.
- Display `dueForReview` beside each book.
- Disable or hide the practice action when `dueForReview` is `0`.
- Let the user choose how many cards to practice.
- The maximum selectable amount should be `dueForReview`.

## 2. Fetch Due Flashcards For Selected Book

```http
GET /api/v1/flashcards/review/due?bookId=<bookId>&limit=<number>
Authorization: Bearer <access_token>
```

Example:

```http
GET /api/v1/flashcards/review/due?bookId=abc-123&limit=5
```

Purpose:

Fetch exactly the requested number of due flashcards from the selected book.

Rules:

- `bookId` comes from `GET /api/v1/books/review/due`.
- `limit` is the number of vocabulary cards the user wants to practice.
- FE should ensure `limit <= dueForReview`.

Response:

```json
[
  {
    "id": "flashcard-id",
    "word": "example",
    "partOfSpeech": "noun",
    "pronunciation": "...",
    "definition": "...",
    "translation": "...",
    "audioUrl": "...",
    "imageUrl": "...",
    "example": "...",
    "exampleTranslation": "...",
    "easeFactor": 2.5,
    "interval": 1,
    "repetitions": 0,
    "nextReviewDate": null,
    "status": "new",
    "createdAt": "2026-08-08T00:00:00.000Z",
    "updatedAt": "2026-08-08T00:00:00.000Z",
    "userId": "user-id",
    "bookId": "abc-123"
  }
]
```

## 3. Record Each Practice Session

For every answered flashcard, FE should record one session.

```http
POST /api/v1/sessions/flashcard/<flashcardId>
Authorization: Bearer <access_token>
Content-Type: application/json
```

Body:

```json
{
  "type": "practice",
  "result": "correct",
  "responseTime": 1200,
  "score": 10
}
```

Allowed `type` values:

```text
review | learn | practice
```

Allowed `result` values:

```text
correct | incorrect | skipped
```

Notes:

- `responseTime` is in milliseconds.
- `score` is optional. If omitted, backend stores `0`.
- Current behavior is one API request per answered flashcard.

## 4. Update Flashcard Review Schedule

After the user answers a card, FE should update the spaced repetition state.

```http
POST /api/v1/flashcards/<flashcardId>/review
Authorization: Bearer <access_token>
Content-Type: application/json
```

Body:

```json
{
  "quality": 4
}
```

`quality` must be from `0` to `5`.

Suggested FE mapping:

```text
correct + easy: 5
correct: 4
correct but hard: 3
incorrect: 1
skipped: 0
```

## Recommended FE Flow

1. User opens the practice screen.
2. FE calls `GET /api/v1/books/review/due`.
3. FE shows books with `dueForReview`.
4. User selects one book.
5. User chooses how many vocabulary cards to practice.
6. FE calls `GET /api/v1/flashcards/review/due?bookId=<bookId>&limit=<number>`.
7. User practices cards one by one.
8. For each answered card, FE calls:
   - `POST /api/v1/sessions/flashcard/<flashcardId>`
   - `POST /api/v1/flashcards/<flashcardId>/review`
9. After practice ends, FE refreshes `GET /api/v1/books/review/due`.


# Topic Vocabulary Suggestions - FE Integration Proposal

## Summary

This feature lets a user enter a topic they want to learn, then receive a list of suggested vocabulary words.

The user can review the suggestions, select the words they want, and create flashcards from the selected items.

Example topics:

```text
travel
restaurant English
job interview
business meeting
IELTS environment
```

## User Flow

1. User opens "Suggest Vocabulary".
2. User enters a topic.
3. User optionally chooses level, result count, target language, and destination book.
4. FE requests topic vocabulary suggestions from BE.
5. FE shows suggestions in a selectable list.
6. User selects the vocabulary they want to learn.
7. User clicks "Create Flashcards".
8. FE creates one flashcard for each selected suggestion.
9. FE navigates user to the book/flashcard list or shows a success state.

## Backend Endpoint

```http
POST /api/v1/words/suggest-topic
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request:

```json
{
  "topic": "restaurant English",
  "level": "beginner",
  "limit": 20,
  "targetLanguage": "vi"
}
```

Fields:

```ts
type SuggestTopicVocabularyRequest = {
  topic: string;
  level?: "beginner" | "intermediate" | "advanced";
  limit?: number;
  targetLanguage?: string;
};
```

Validation:

- `topic` is required.
- `topic` max length should be 100 characters.
- `level` is optional.
- `limit` is optional, recommended default `20`.
- `limit` should be between `1` and `50`.
- `targetLanguage` is optional, recommended default `vi`.

## Response

```json
{
  "topic": "restaurant English",
  "level": "beginner",
  "targetLanguage": "vi",
  "suggestions": [
    {
      "word": "reservation",
      "partOfSpeech": "noun",
      "definition": "An arrangement to have something held for later use.",
      "translation": "su dat cho",
      "example": "I made a reservation for two people.",
      "exampleTranslation": "Toi da dat cho cho hai nguoi.",
      "difficulty": "beginner"
    },
    {
      "word": "menu",
      "partOfSpeech": "noun",
      "definition": "A list of food and drinks available at a restaurant.",
      "translation": "thuc don",
      "example": "Could I see the menu, please?",
      "exampleTranslation": "Cho toi xem thuc don duoc khong?",
      "difficulty": "beginner"
    }
  ]
}
```

FE type:

```ts
type TopicVocabularySuggestion = {
  word: string;
  partOfSpeech?: string;
  definition?: string;
  translation?: string;
  example?: string;
  exampleTranslation?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
};

type SuggestTopicVocabularyResponse = {
  topic: string;
  level?: "beginner" | "intermediate" | "advanced";
  targetLanguage: string;
  suggestions: TopicVocabularySuggestion[];
};
```

## FE Screen Design

Recommended controls:

- Topic text input.
- Level segmented control:
  - Beginner
  - Intermediate
  - Advanced
- Count selector:
  - 10
  - 20
  - 30
- Target language selector, default Vietnamese.
- Optional destination book selector.
- Generate button.
- Select all checkbox.
- Per-word checkbox.
- Create Flashcards button.

## Suggestion List UI

Each suggestion row/card should show:

- Word
- Part of speech
- Translation
- Short definition
- Example sentence
- Example translation
- Difficulty label, if available
- Checkbox selection state

Recommended row actions:

- Select/unselect word.
- Edit suggestion before creating flashcard.
- Remove suggestion from the list.

## Selection State

FE should keep local selection state separate from BE response.

Example:

```ts
type SelectableVocabularySuggestion = TopicVocabularySuggestion & {
  id: string;
  selected: boolean;
};
```

Use a local generated ID because `word` alone may not be unique if BE returns variants later.

```ts
const items = response.suggestions.map((suggestion, index) => ({
  ...suggestion,
  id: `${suggestion.word}-${index}`,
  selected: true,
}));
```

Default recommendation:

- Select all suggestions by default.
- Let user deselect words they do not want.

## Create Flashcards

For each selected item, FE should call the existing flashcard create endpoint.

```http
POST /api/v1/flashcards
Authorization: Bearer <access_token>
Content-Type: application/json
```

Body:

```json
{
  "word": "reservation",
  "partOfSpeech": "noun",
  "definition": "An arrangement to have something held for later use.",
  "translation": "su dat cho",
  "example": "I made a reservation for two people.",
  "exampleTranslation": "Toi da dat cho cho hai nguoi.",
  "bookId": "optional-book-id"
}
```

Mapping:

```ts
function toCreateFlashcardPayload(
  suggestion: TopicVocabularySuggestion,
  bookId?: string,
) {
  return {
    word: suggestion.word,
    partOfSpeech: suggestion.partOfSpeech,
    definition: suggestion.definition,
    translation: suggestion.translation,
    example: suggestion.example,
    exampleTranslation: suggestion.exampleTranslation,
    bookId,
  };
}
```

Notes:

- `audioUrl`, `imageUrl`, and `exampleAudioUrl` do not need to be sent by FE.
- BE already enriches missing flashcard media asynchronously.
- If `bookId` is not selected, flashcards are created without a book.

## Batch Creation Strategy

Initial FE implementation can create flashcards with parallel requests:

```ts
await Promise.all(
  selectedItems.map((item) =>
    api.post("/api/v1/flashcards", toCreateFlashcardPayload(item, bookId)),
  ),
);
```

Recommended UX:

- Disable Create button while requests are in progress.
- Show progress like `Creating 3 of 20`.
- If some requests fail, show partial success:
  - Created count
  - Failed count
  - Retry failed button

Future backend improvement:

```http
POST /api/v1/flashcards/bulk
```

This is not required for Phase 1.

## Loading And Error States

Generate suggestions loading state:

```text
Finding vocabulary...
```

Empty state:

```text
No vocabulary found for this topic.
```

Common errors:

- Missing topic.
- Topic too long.
- BE generation failed.
- User reached subscription flashcard or word limit.
- Some selected flashcards already exist.

FE should keep generated suggestions visible if flashcard creation partially fails, so the user can retry.

## Duplicate Handling

Current backend has a unique flashcard rule by user and word.

If user tries to create a flashcard for a word they already have, BE may reject it.

Recommended FE behavior:

- If duplicate error occurs, mark that row as already exists.
- Continue creating the other selected words.
- Show a summary after creation.

Example summary:

```text
18 flashcards created.
2 already existed.
```

## Recommended Phase 1

Build FE around these assumptions:

1. Topic suggestion endpoint returns vocabulary candidates only.
2. FE owns selection, editing, and create flow.
3. FE creates flashcards using existing `POST /api/v1/flashcards`.
4. BE enriches media after flashcard creation.
5. No real-time request is needed after every selection change.

## Future Enhancements

Possible later improvements:

- Add `POST /api/v1/flashcards/bulk`.
- Add "exclude words I already know".
- Add CEFR levels: `A1`, `A2`, `B1`, `B2`, `C1`, `C2`.
- Add topic categories.
- Add preview details by calling `GET /api/v1/words/suggest?word=<word>`.
- Add one-click "create book from topic".
- Add accepted answers or synonyms.

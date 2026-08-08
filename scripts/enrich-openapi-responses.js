const fs = require('fs');
const path = require('path');

const inputPath = path.resolve(__dirname, '..', 'openapi.json');
const outputPath = path.resolve(__dirname, '..', 'openapi.with-responses.json');

const openapi = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
openapi.info.description = `${openapi.info.description || 'FLENVN API'} Includes inferred response schemas for frontend integration. Successful responses are wrapped by ResponseInterceptor as { success, data, timestamp }.`;

const schemas = (openapi.components.schemas ||= {});

function addSchema(name, schema) {
  schemas[name] = schema;
}

const uuid = {
  type: 'string',
  format: 'uuid',
  example: '550e8400-e29b-41d4-a716-446655440000',
};
const dateTime = {
  type: 'string',
  format: 'date-time',
  example: '2026-08-01T10:00:00.000Z',
};
const date = { type: 'string', format: 'date', example: '2026-08-01' };
const message = {
  type: 'object',
  properties: {
    message: { type: 'string', example: 'Operation completed successfully' },
  },
  required: ['message'],
};

addSchema('ApiEnvelope', {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {},
    message: { type: 'string', example: 'Optional message' },
    timestamp: dateTime,
  },
  required: ['success', 'data', 'timestamp'],
});

addSchema('ErrorResponse', {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 400 },
    timestamp: dateTime,
    path: { type: 'string', example: '/api/v1/auth/login' },
    method: { type: 'string', example: 'POST' },
    message: { type: 'string', example: 'Invalid credentials' },
    details: {},
  },
  required: ['statusCode', 'timestamp', 'path', 'method', 'message'],
});

addSchema('UserResponse', {
  type: 'object',
  properties: {
    id: uuid,
    email: { type: 'string', format: 'email', example: 'user@example.com' },
    username: { type: 'string', nullable: true, example: 'linh' },
    avatar: {
      type: 'string',
      nullable: true,
      example: 'https://example.com/avatar.jpg',
    },
    isEmailVerified: { type: 'boolean', example: true },
    level: { type: 'number', example: 1 },
    exp: { type: 'number', example: 0 },
    streak: { type: 'number', example: 0 },
    lastActive: { ...dateTime, nullable: true },
    isActive: { type: 'boolean', example: true },
    isAdmin: { type: 'boolean', example: false },
    booksCount: { type: 'number', example: 2 },
    totalWordsUsed: { type: 'number', example: 1200 },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
});

addSchema('AuthUserResponse', {
  type: 'object',
  properties: {
    id: uuid,
    email: { type: 'string', format: 'email', example: 'user@example.com' },
    username: { type: 'string', nullable: true, example: 'linh' },
    avatar: { type: 'string', example: 'https://example.com/avatar.jpg' },
    isAdmin: { type: 'boolean', example: false },
  },
});

addSchema('RegisterResponseData', {
  type: 'object',
  properties: {
    user: { $ref: '#/components/schemas/UserResponse' },
    accessToken: { type: 'string', example: 'jwt-access-token' },
    refreshToken: { type: 'string', example: 'refresh-token' },
    emailVerificationRequired: { type: 'boolean', example: true },
  },
});

addSchema('LoginResponseData', {
  type: 'object',
  properties: {
    user: { $ref: '#/components/schemas/AuthUserResponse' },
    accessToken: { type: 'string', example: 'jwt-access-token' },
    refreshToken: { type: 'string', example: 'refresh-token' },
  },
});

addSchema('TokenResponseData', {
  type: 'object',
  properties: {
    accessToken: { type: 'string', example: 'jwt-access-token' },
    refreshToken: { type: 'string', example: 'refresh-token' },
  },
});

addSchema('BookResponse', {
  type: 'object',
  properties: {
    id: uuid,
    userId: uuid,
    title: { type: 'string', example: 'English Stories' },
    description: {
      type: 'string',
      nullable: true,
      example: 'Short reading practice',
    },
    author: { type: 'string', nullable: true, example: 'FLENVN' },
    coverImage: {
      type: 'string',
      nullable: true,
      example: 'https://example.com/book.png',
    },
    content: { type: 'string', nullable: true, example: 'Once upon a time...' },
    wordCount: { type: 'number', example: 450 },
    totalCards: { type: 'number', example: 12 },
    isPublic: { type: 'boolean', example: true },
    createdAt: dateTime,
    updatedAt: dateTime,
    flashcards: {
      type: 'array',
      items: { $ref: '#/components/schemas/FlashcardResponse' },
    },
    user: { $ref: '#/components/schemas/UserResponse' },
  },
});

addSchema('FlashcardResponse', {
  type: 'object',
  properties: {
    id: uuid,
    word: { type: 'string', example: 'serendipity' },
    partOfSpeech: { type: 'string', nullable: true, example: 'noun' },
    pronunciation: {
      type: 'string',
      nullable: true,
      example: '/ˌserənˈdipəti/',
    },
    definition: {
      type: 'string',
      nullable: true,
      example: 'The occurrence of events by chance in a happy way.',
    },
    translation: {
      type: 'string',
      nullable: true,
      example: 'sự tình cờ may mắn',
    },
    audioUrl: {
      type: 'string',
      nullable: true,
      example: 'https://example.com/audio.mp3',
    },
    imageUrl: {
      type: 'string',
      nullable: true,
      example: 'https://example.com/image.jpg',
    },
    example: {
      type: 'string',
      nullable: true,
      example: 'Finding that book was pure serendipity.',
    },
    exampleTranslation: {
      type: 'string',
      nullable: true,
      example: 'Tìm thấy cuốn sách đó là một sự tình cờ may mắn.',
    },
    easeFactor: { type: 'number', example: 2.5 },
    interval: { type: 'number', example: 1 },
    repetitions: { type: 'number', example: 0 },
    nextReviewDate: { ...dateTime, nullable: true },
    status: {
      type: 'string',
      enum: ['new', 'learning', 'reviewing', 'mastered'],
      example: 'new',
    },
    userId: uuid,
    bookId: { ...uuid, nullable: true },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
});

addSchema('FlashcardStatsResponse', {
  type: 'object',
  properties: {
    total: { type: 'number', example: 120 },
    new: { type: 'number', example: 30 },
    learning: { type: 'number', example: 20 },
    reviewing: { type: 'number', example: 60 },
    mastered: { type: 'number', example: 10 },
    dueForReview: { type: 'number', example: 8 },
  },
});

addSchema('SubscriptionPlanResponse', {
  type: 'object',
  properties: {
    id: uuid,
    name: { type: 'string', example: 'Free' },
    description: {
      type: 'string',
      nullable: true,
      example: 'Default free plan',
    },
    price: { type: 'number', example: 0 },
    maxBooks: { type: 'number', example: 5 },
    maxWords: { type: 'number', example: 50000 },
    maxFlashcards: { type: 'number', example: 100 },
    features: {
      type: 'object',
      additionalProperties: { type: 'boolean' },
      example: { emailSupport: true },
    },
    isActive: { type: 'boolean', example: true },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
});

addSchema('UserSubscriptionResponse', {
  type: 'object',
  properties: {
    id: uuid,
    userId: uuid,
    planId: uuid,
    startDate: date,
    endDate: { ...date, nullable: true },
    isActive: { type: 'boolean', example: true },
    createdAt: dateTime,
    updatedAt: dateTime,
    plan: { $ref: '#/components/schemas/SubscriptionPlanResponse' },
  },
});

addSchema('UsageStatsResponse', {
  type: 'object',
  properties: {
    currentPlan: { $ref: '#/components/schemas/SubscriptionPlanResponse' },
    booksUsed: { type: 'number', example: 2 },
    booksLimit: { type: 'number', example: 5 },
    wordsUsed: { type: 'number', example: 1200 },
    wordsLimit: { type: 'number', example: 50000 },
    percentageUsed: {
      type: 'object',
      properties: {
        books: { type: 'number', example: 40 },
        words: { type: 'number', example: 2 },
      },
    },
  },
});

addSchema('SessionResponse', {
  type: 'object',
  properties: {
    id: uuid,
    type: {
      type: 'string',
      enum: ['review', 'learn', 'practice'],
      example: 'review',
    },
    result: {
      type: 'string',
      enum: ['correct', 'incorrect', 'skipped'],
      example: 'correct',
    },
    responseTime: { type: 'number', nullable: true, example: 1800 },
    score: { type: 'number', example: 10 },
    createdAt: dateTime,
    userId: uuid,
    flashcardId: uuid,
  },
});

addSchema('CreateSessionResponseData', {
  type: 'object',
  properties: {
    message: { type: 'string', example: 'Session recorded successfully' },
    session: { $ref: '#/components/schemas/SessionResponse' },
  },
});

addSchema('SessionHistoryResponseData', {
  type: 'object',
  properties: {
    sessions: {
      type: 'array',
      items: { $ref: '#/components/schemas/SessionResponse' },
    },
    count: { type: 'number', example: 3 },
  },
});

addSchema('StudyStatsResponse', {
  type: 'object',
  properties: {
    totalSessions: { type: 'number', example: 25 },
    correctAnswers: { type: 'number', example: 18 },
    incorrectAnswers: { type: 'number', example: 5 },
    skipped: { type: 'number', example: 2 },
    accuracy: { type: 'number', example: 72 },
    averageResponseTime: { type: 'number', example: 1530 },
    sessionsByType: {
      type: 'object',
      properties: {
        review: { type: 'number', example: 12 },
        learn: { type: 'number', example: 8 },
        practice: { type: 'number', example: 5 },
      },
    },
    dailyStats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string', example: '2026-08-01' },
          sessions: { type: 'number', example: 4 },
          correct: { type: 'number', example: 3 },
          incorrect: { type: 'number', example: 1 },
        },
      },
    },
  },
});

addSchema('StreakStatsResponse', {
  type: 'object',
  properties: {
    currentStreak: { type: 'number', example: 3 },
    longestStreak: { type: 'number', example: 10 },
    lastStudyDate: { ...dateTime, nullable: true },
  },
});

addSchema('TranslateResponse', {
  type: 'object',
  properties: {
    translatedText: { type: 'string', example: 'Xin chào' },
    sourceLanguage: { type: 'string', example: 'en' },
    targetLanguage: { type: 'string', example: 'vi' },
  },
});

addSchema('UploadUrlResponse', {
  type: 'object',
  properties: {
    uploadUrl: {
      type: 'string',
      example: 'https://bucket.s3.region.amazonaws.com/key?signature=...',
    },
    fileUrl: {
      type: 'string',
      example: 'https://bucket.s3.region.amazonaws.com/images/user/file.jpg',
    },
    objectKey: {
      type: 'string',
      example: 'images/user-id/1722519900000-file.jpg',
    },
    expiresIn: { type: 'number', example: 3600 },
  },
});

addSchema('WordSuggestionResponse', {
  type: 'object',
  properties: {
    word: { type: 'string', example: 'serendipity' },
    pronunciation: { type: 'string', example: '/ˌserənˈdipəti/' },
    partOfSpeech: { type: 'string', example: 'noun' },
    definitions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          partOfSpeech: { type: 'string' },
        },
      },
    },
    translation: { type: 'string', example: 'sự tình cờ may mắn' },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', example: 'It was pure serendipity.' },
          translation: {
            type: 'string',
            example: 'Đó hoàn toàn là sự tình cờ may mắn.',
          },
          meaning: { type: 'string' },
          partOfSpeech: { type: 'string' },
          source: { type: 'string', enum: ['openai', 'dictionary'] },
        },
      },
    },
    audio: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        source: { type: 'string', enum: ['polly', 'dictionary'] },
      },
    },
    images: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          source: { type: 'string', enum: ['pexels', 'unsplash', 'default'] },
          photographer: { type: 'string' },
          photographerUrl: { type: 'string' },
        },
      },
    },
    sources: {
      type: 'object',
      properties: {
        dictionary: { type: 'string' },
        translation: { type: 'string' },
        audio: { type: 'string' },
        examples: { type: 'string' },
        images: {
          type: 'array',
          items: { type: 'string', enum: ['pexels', 'unsplash', 'default'] },
        },
      },
    },
  },
});

addSchema('WordAutocompleteResponse', {
  type: 'object',
  properties: {
    query: { type: 'string', example: 'resil' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string', example: 'resilient' },
          score: { type: 'number', example: 1234 },
        },
      },
    },
    source: { type: 'string', enum: ['datamuse'], example: 'datamuse' },
  },
});

addSchema('TextCorrectionResponse', {
  type: 'object',
  properties: {
    original: { type: 'string', example: 'she go to school yesterday' },
    corrected: { type: 'string', example: 'She went to school yesterday.' },
    language: { type: 'string', example: 'en-US' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          offset: { type: 'number', example: 4 },
          length: { type: 'number', example: 2 },
          original: { type: 'string', example: 'go' },
          replacements: {
            type: 'array',
            items: { type: 'string' },
            example: ['went'],
          },
          message: { type: 'string', example: 'Possible grammar issue' },
          ruleId: { type: 'string', example: 'PAST_TENSE' },
          issueType: { type: 'string', example: 'grammar' },
        },
      },
    },
    source: {
      type: 'string',
      enum: ['languagetool'],
      example: 'languagetool',
    },
  },
});

function envelope(schemaRefOrSchema) {
  return {
    allOf: [
      { $ref: '#/components/schemas/ApiEnvelope' },
      { type: 'object', properties: { data: schemaRefOrSchema } },
    ],
  };
}

function jsonResponse(dataSchema, description = 'Successful response') {
  return {
    description,
    content: {
      'application/json': {
        schema: envelope(dataSchema),
      },
    },
  };
}

function errorResponses(...statuses) {
  return Object.fromEntries(
    statuses.map((status) => [
      String(status),
      {
        description: `${status} error response`,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    ]),
  );
}

const routes = {
  'GET /api/v1': {
    status: '200',
    schema: { type: 'string', example: 'Hello World!' },
  },
  'POST /api/v1/auth/register': {
    status: '201',
    schema: { $ref: '#/components/schemas/RegisterResponseData' },
    errors: [400, 409, 429, 500],
  },
  'POST /api/v1/auth/login': {
    status: '200',
    schema: { $ref: '#/components/schemas/LoginResponseData' },
    errors: [400, 401, 403, 429, 500],
  },
  'POST /api/v1/auth/refresh': {
    status: '200',
    schema: { $ref: '#/components/schemas/TokenResponseData' },
    errors: [400, 401, 429, 500],
  },
  'POST /api/v1/auth/logout': {
    status: '200',
    schema: message,
    errors: [401, 500],
  },
  'GET /api/v1/auth/verify-email': {
    status: '200',
    schema: message,
    errors: [400, 429, 500],
  },
  'GET /api/v1/auth/profile': {
    status: '200',
    schema: {
      type: 'object',
      properties: { user: { $ref: '#/components/schemas/UserResponse' } },
    },
    errors: [401, 500],
  },
  'GET /api/v1/users/profile': {
    status: '200',
    schema: { $ref: '#/components/schemas/UserResponse' },
    errors: [401, 404, 500],
  },
  'PUT /api/v1/users/profile': {
    status: '200',
    schema: { $ref: '#/components/schemas/UserResponse' },
    errors: [400, 401, 404, 500],
  },
  'POST /api/v1/users/change-password': {
    status: '200',
    schema: message,
    errors: [400, 401, 500],
  },
  'GET /api/v1/users': {
    status: '200',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/UserResponse' },
    },
    errors: [401, 403, 500],
  },
  'GET /api/v1/users/{id}': {
    status: '200',
    schema: { $ref: '#/components/schemas/UserResponse' },
    errors: [401, 403, 404, 500],
  },
  'DELETE /api/v1/users/{id}': {
    status: '200',
    schema: message,
    errors: [401, 403, 404, 500],
  },
  'POST /api/v1/books': {
    status: '201',
    schema: { $ref: '#/components/schemas/BookResponse' },
    errors: [400, 401, 500],
  },
  'GET /api/v1/books': {
    status: '200',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/BookResponse' },
    },
    errors: [401, 500],
  },
  'GET /api/v1/books/public': {
    status: '200',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/BookResponse' },
    },
    errors: [500],
  },
  'GET /api/v1/books/{id}': {
    status: '200',
    schema: { $ref: '#/components/schemas/BookResponse' },
    errors: [401, 403, 404, 500],
  },
  'PUT /api/v1/books/{id}': {
    status: '200',
    schema: { $ref: '#/components/schemas/BookResponse' },
    errors: [400, 401, 403, 404, 500],
  },
  'DELETE /api/v1/books/{id}': {
    status: '200',
    schema: message,
    errors: [401, 403, 404, 500],
  },
  'POST /api/v1/flashcards': {
    status: '201',
    schema: { $ref: '#/components/schemas/FlashcardResponse' },
    errors: [400, 401, 404, 500],
  },
  'GET /api/v1/flashcards': {
    status: '200',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/FlashcardResponse' },
    },
    errors: [400, 401, 500],
  },
  'GET /api/v1/flashcards/review/due': {
    status: '200',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/FlashcardResponse' },
    },
    errors: [401, 500],
  },
  'GET /api/v1/flashcards/stats': {
    status: '200',
    schema: { $ref: '#/components/schemas/FlashcardStatsResponse' },
    errors: [401, 500],
  },
  'GET /api/v1/flashcards/{id}': {
    status: '200',
    schema: { $ref: '#/components/schemas/FlashcardResponse' },
    errors: [401, 403, 404, 500],
  },
  'PUT /api/v1/flashcards/{id}': {
    status: '200',
    schema: { $ref: '#/components/schemas/FlashcardResponse' },
    errors: [400, 401, 403, 404, 500],
  },
  'DELETE /api/v1/flashcards/{id}': {
    status: '200',
    schema: message,
    errors: [401, 403, 404, 500],
  },
  'POST /api/v1/flashcards/{id}/review': {
    status: '200',
    schema: { $ref: '#/components/schemas/FlashcardResponse' },
    errors: [400, 401, 403, 404, 500],
  },
  'POST /api/v1/flashcards/{id}/mastered': {
    status: '200',
    schema: { $ref: '#/components/schemas/FlashcardResponse' },
    errors: [401, 403, 404, 500],
  },
  'POST /api/v1/sessions/flashcard/{flashcardId}': {
    status: '201',
    schema: { $ref: '#/components/schemas/CreateSessionResponseData' },
    errors: [400, 401, 403, 404, 500],
  },
  'GET /api/v1/sessions': {
    status: '200',
    schema: { $ref: '#/components/schemas/SessionHistoryResponseData' },
    errors: [401, 500],
  },
  'GET /api/v1/sessions/stats': {
    status: '200',
    schema: { $ref: '#/components/schemas/StudyStatsResponse' },
    errors: [401, 500],
  },
  'GET /api/v1/sessions/streak': {
    status: '200',
    schema: { $ref: '#/components/schemas/StreakStatsResponse' },
    errors: [401, 500],
  },
  'DELETE /api/v1/sessions/{sessionId}': {
    status: '200',
    schema: message,
    errors: [401, 403, 404, 500],
  },
  'POST /api/v1/subscriptions/plans': {
    status: '201',
    schema: { $ref: '#/components/schemas/SubscriptionPlanResponse' },
    errors: [400, 401, 403, 500],
  },
  'GET /api/v1/subscriptions/plans': {
    status: '200',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/SubscriptionPlanResponse' },
    },
    errors: [500],
  },
  'GET /api/v1/subscriptions/plans/{id}': {
    status: '200',
    schema: { $ref: '#/components/schemas/SubscriptionPlanResponse' },
    errors: [404, 500],
  },
  'PUT /api/v1/subscriptions/plans/{id}': {
    status: '200',
    schema: { $ref: '#/components/schemas/SubscriptionPlanResponse' },
    errors: [400, 401, 403, 404, 500],
  },
  'DELETE /api/v1/subscriptions/plans/{id}': {
    status: '200',
    schema: message,
    errors: [401, 403, 404, 500],
  },
  'GET /api/v1/subscriptions/my-subscription': {
    status: '200',
    schema: { $ref: '#/components/schemas/UserSubscriptionResponse' },
    errors: [401, 404, 500],
  },
  'POST /api/v1/subscriptions/upgrade': {
    status: '200',
    schema: { $ref: '#/components/schemas/UserSubscriptionResponse' },
    errors: [400, 401, 404, 500],
  },
  'GET /api/v1/subscriptions/usage': {
    status: '200',
    schema: { $ref: '#/components/schemas/UsageStatsResponse' },
    errors: [401, 404, 500],
  },
  'POST /api/v1/subscriptions/check-book-limit': {
    status: '200',
    schema: {
      type: 'object',
      properties: { canAdd: { type: 'boolean', example: true } },
    },
    errors: [401, 404, 500],
  },
  'POST /api/v1/subscriptions/check-words-limit': {
    status: '200',
    schema: {
      type: 'object',
      properties: { canAdd: { type: 'boolean', example: true } },
    },
    errors: [400, 401, 404, 500],
  },
  'POST /api/v1/translation/translate': {
    status: '201',
    schema: { $ref: '#/components/schemas/TranslateResponse' },
    errors: [400, 500],
  },
  'GET /api/v1/uploads/presign-image': {
    status: '200',
    schema: { $ref: '#/components/schemas/UploadUrlResponse' },
    errors: [400, 401, 500],
  },
  'POST /api/v1/uploads/presign-image': {
    status: '201',
    schema: { $ref: '#/components/schemas/UploadUrlResponse' },
    errors: [400, 401, 500],
  },
  'GET /api/v1/words/autocomplete': {
    status: '200',
    schema: { $ref: '#/components/schemas/WordAutocompleteResponse' },
    errors: [400, 401, 500],
  },
  'POST /api/v1/words/correct': {
    status: '201',
    schema: { $ref: '#/components/schemas/TextCorrectionResponse' },
    errors: [400, 401, 500],
  },
  'GET /api/v1/words/suggest': {
    status: '200',
    schema: { $ref: '#/components/schemas/WordSuggestionResponse' },
    errors: [400, 401, 500],
  },
};

for (const [rawPath, pathItem] of Object.entries(openapi.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    const route = routes[`${method.toUpperCase()} ${rawPath}`];
    if (!route) continue;
    operation.responses = {
      [route.status]: jsonResponse(route.schema),
      ...errorResponses(...(route.errors || [500])),
    };
  }
}

fs.writeFileSync(outputPath, JSON.stringify(openapi, null, 2), 'utf8');
process.stdout.write(`Wrote ${outputPath}\n`);

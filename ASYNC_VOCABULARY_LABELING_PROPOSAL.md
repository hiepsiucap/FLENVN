# Async Vocabulary Labeling Proposal

## Summary

Add labels to flashcards so users can filter vocabulary and start practice games from one or more labels. Labels can be assigned manually or suggested automatically by Gemini.

Automatic labeling runs asynchronously so flashcard creation and editing do not wait for Gemini. The API persists the flashcard, publishes a labeling job to Amazon SQS, and returns immediately. A lightweight consumer inside the existing NestJS process classifies one flashcard at a time and saves validated labels. The consumer can move to a separate worker later without changing the job contract.

Recommended initial architecture:

```text
Client
  |
  v
NestJS API + label consumer ---> PostgreSQL
  |                ^                 ^
  v                |                 |
Amazon SQS --------+                 |
  |                                  |
  +---- label job ---> Gemini --------+
```

## Goals

- Allow a flashcard to have multiple labels.
- Allow users to create and assign their own labels.
- Suggest consistent topic, CEFR-level, and usage labels with Gemini.
- Keep flashcard creation and editing responsive.
- Filter normal and due-for-review flashcards by labels.
- Preserve manually assigned labels when AI classification is repeated.
- Make job processing retryable, observable, and idempotent.
- Prevent an old classification job from labeling newer flashcard content.

## Non-goals for the first release

- Automatically generating an unlimited free-form taxonomy.
- Personalized taxonomy generation for each user.
- Label-based practice analytics and historical label snapshots.
- Real-time WebSocket notification when labeling finishes.
- Moving the worker to a separate server before traffic requires it.

## Product behavior

### Manual labeling

Users can create, rename, recolor, and delete labels. They can attach multiple labels to a flashcard. Deleting a label removes its associations but does not delete flashcards.

### Automatic labeling

On flashcard creation, the response is returned with `labelingStatus: "pending"`. The worker later attaches AI-generated labels and changes the status to `completed`.

The frontend can show:

```text
Labels: Organizing...
```

Flashcards remain usable while labeling is pending or failed.

### Practice by label

Users can select one or more labels, choose the number of cards, and start the existing practice flow. Label filtering only narrows the eligible flashcards; it does not change the spaced-repetition rules.

## Label taxonomy

Gemini should classify into a controlled taxonomy instead of inventing label names. This prevents near-duplicates such as `Travel`, `Travelling`, `Tourism`, and `Trips`.

Initial label types:

```text
topic: travel, food-and-drink, business, education, technology,
       health, family, relationships, shopping, transportation,
       work, finance, environment, entertainment, sports, home,
       clothing, emotions, communication, daily-life

level: A1, A2, B1, B2, C1, C2

usage: formal, informal, academic, slang, technical
```

The exact topic list should be treated as versioned application configuration. Updating it should not require changing the Gemini prompt in several services.

Part of speech remains the existing `partOfSpeech` flashcard field and should not be duplicated as a label.

## Data model

### `labels`

```text
id              uuid primary key
userId          uuid not null
name            varchar(50) not null
normalizedName  varchar(50) not null
type            enum(topic, level, usage, custom) not null
color           varchar(7) nullable
createdAt       timestamp not null
updatedAt       timestamp not null
```

Constraints and indexes:

- Unique `(userId, normalizedName)`.
- Index `(userId, type)`.
- `normalizedName` is produced by trimming and lowercasing the name.
- A user can only manage and assign their own labels.

For the first release, controlled AI labels are created inside each user's label collection when first needed. A future version may introduce global system-label definitions if centralized localization or taxonomy management becomes necessary.

### `flashcard_labels`

```text
flashcardId       uuid not null
labelId           uuid not null
source            enum(manual, gemini, system) not null
confirmedByUser   boolean not null default false
createdAt         timestamp not null
```

Constraints and indexes:

- Composite primary key or unique constraint `(flashcardId, labelId)`.
- Index `labelId` for label filtering.
- Foreign keys use `ON DELETE CASCADE`.
- Service validation ensures the flashcard and label belong to the same user.

If a user manually confirms an AI label, its association should change to `source = manual` and `confirmedByUser = true`. Future AI relabeling must preserve it.

### Flashcard labeling state

Add to `flashcards`:

```text
labelingStatus    enum(pending, processing, completed, failed)
labelingVersion   integer not null default 1
labelingAttempts  integer not null default 0
labeledAt         timestamp nullable
```

Detailed provider errors should be recorded in application logs rather than exposed through normal API responses.

## API proposal

All endpoints require authentication.

### Manage labels

```http
POST   /api/v1/labels
GET    /api/v1/labels?includeCounts=true
PUT    /api/v1/labels/:labelId
DELETE /api/v1/labels/:labelId
```

Create request:

```json
{
  "name": "Important",
  "type": "custom",
  "color": "#3B82F6"
}
```

List response item:

```json
{
  "id": "label-uuid",
  "name": "Travel",
  "type": "topic",
  "color": "#3B82F6",
  "totalCards": 35,
  "dueCards": 12
}
```

### Assign labels

Replace the complete manually managed label selection:

```http
PUT /api/v1/flashcards/:flashcardId/labels
```

```json
{
  "labelIds": ["label-uuid-1", "label-uuid-2"]
}
```

This operation must preserve unconfirmed Gemini associations unless the API contract explicitly allows the client to remove them. A simple frontend can instead send the complete desired set and have the backend convert retained labels to manual associations.

Suggested limits:

- Maximum 100 labels per user.
- Maximum 10 labels per flashcard.
- Maximum label name length of 50 characters.

### Filter flashcards

Extend the existing flashcard endpoint:

```http
GET /api/v1/flashcards?labelIds=id1,id2&labelMode=any
GET /api/v1/flashcards?labelIds=id1,id2&labelMode=all
```

Rules:

- `any`: flashcard contains at least one selected label.
- `all`: flashcard contains every selected label.
- Default `labelMode` is `any`.
- Existing `bookId` and `status` filters can be combined with labels.
- Unknown or unauthorized label IDs return `400 Bad Request` rather than silently returning no results.

Prefer `EXISTS` subqueries or grouped join queries so multiple matching labels do not duplicate flashcards.

### Fetch due cards for label practice

Extend the existing due-review endpoint:

```http
GET /api/v1/flashcards/review/due?labelIds=id1,id2&labelMode=any&limit=20
```

Existing ownership, due-date, mastered-status, ordering, and limit behavior remains unchanged.

### Retry failed classification

```http
POST /api/v1/flashcards/:flashcardId/labels/retry
```

The endpoint should be rate limited and normally allowed only for `failed` jobs. Administrative recovery can republish old pending jobs separately.

## Flashcard write flow

### Create

1. Validate the flashcard request and optional manually selected label IDs.
2. Save the flashcard with `labelingStatus = pending` and `labelingVersion = 1`.
3. Save manual label associations.
4. Publish an SQS message after the database transaction commits.
5. Return the flashcard immediately.

Example response:

```json
{
  "id": "flashcard-uuid",
  "word": "reservation",
  "labels": [],
  "labelingStatus": "pending",
  "labelingVersion": 1
}
```

An SQS publish failure must not fail or delete an otherwise valid flashcard. Mark the labeling state as failed or leave it pending for the recovery publisher.

### Update

Relabel only when one of these fields changes:

- `word`
- `partOfSpeech`
- `definition`
- `translation`
- `example`

On a relevant change:

1. Increment `labelingVersion`.
2. Set `labelingStatus = pending`.
3. Clear `labeledAt`.
4. Commit the flashcard update.
5. Publish a job with the new version.

Audio and image changes do not trigger relabeling.

## Queue design

### SQS message

```json
{
  "type": "classify-flashcard-labels",
  "flashcardId": "flashcard-uuid",
  "userId": "user-uuid",
  "labelingVersion": 1
}
```

Do not send definitions, translations, or examples through SQS. The worker retrieves the latest flashcard from PostgreSQL.

Suggested SQS configuration:

```text
Queue type: Standard
Visibility timeout: 60 seconds
Long polling: 20 seconds
Maximum receive count: 3
Dead-letter queue: enabled
Message retention: 4 days
```

Standard SQS provides at-least-once delivery, so the worker must be idempotent.

### Worker behavior

1. Receive a message.
2. Load the flashcard using both `flashcardId` and `userId`.
3. Stop successfully if the flashcard was deleted.
4. Stop successfully if `labelingVersion` no longer matches.
5. Atomically change `pending` to `processing` for that version.
6. Call Gemini with the controlled taxonomy and structured JSON schema.
7. Validate and normalize every returned label.
8. In a database transaction:
   - Recheck the labeling version.
   - Delete only existing `source = gemini` associations.
   - Find or create the controlled labels for the user.
   - Insert associations idempotently.
   - Set status to `completed` and set `labeledAt`.
9. Acknowledge the SQS message only after the transaction commits.

If the provider request or database transaction fails, do not acknowledge the message. Increment attempt metrics and allow SQS to retry it.

Suggested initial worker settings:

```text
Worker processes: 1
Job concurrency: 2
Gemini timeout: 20 seconds
Maximum Gemini output tokens: 300
Gemini temperature: 0
```

Concurrency can later be configured using environment variables according to Gemini quota and EC2 capacity.

## Stale-job protection

Versioning prevents old Gemini results from overwriting classification for newer content.

Example:

```text
Version 1: bank = a financial institution
Version 1 job starts
Version 2: user edits definition to land beside a river
Version 1 job finishes
```

The version 1 worker must recheck the database before saving and discard its output because the current version is 2.

## Gemini classification contract

Gemini receives:

- Word.
- Part of speech.
- Definition.
- Translation.
- Example sentence.
- Allowed topic, level, and usage values.

The prompt must state that vocabulary content is data, not instructions.

Expected output:

```json
{
  "topics": ["travel", "food-and-drink"],
  "level": "B1",
  "usage": ["daily-life"]
}
```

Rules:

- At most three topics.
- Exactly one CEFR level when enough information is available.
- At most two usage labels.
- Values must be present in the server-owned taxonomy.
- Unknown output is discarded even when it passes JSON parsing.
- An empty valid classification is allowed; the job can still be completed.

Use the existing `@google/genai` Vertex AI configuration. Extracting Gemini client construction and common error handling from `WordsExampleService` into a shared provider service is recommended before adding a second Gemini consumer.

## Reliability strategy

Publishing to SQS and writing PostgreSQL cannot share a transaction. The initial implementation should include recovery for this gap.

### Initial approach

- Commit the flashcard first.
- Publish the job.
- Log publishing failures.
- Periodically find flashcards that have remained `pending` longer than a configured threshold and republish them.
- Use `(flashcardId, labelingVersion)` as the logical idempotency key.

### Future transactional outbox

If labeling volume or reliability requirements increase, add an outbox table. Save the flashcard update and outbox record in the same PostgreSQL transaction. An outbox publisher then sends records to SQS and marks them published.

The outbox is not required for the first delivery if pending-job recovery is implemented.

## Deployment

### AWS CDK

Add:

- Main SQS labeling queue.
- Dead-letter queue.
- Redrive policy.
- EC2 IAM permissions for receive, delete, get attributes, and send message.
- Queue URLs exposed to the application through deployment configuration.

### Runtime topology

The current EC2 configuration defaults to a memory-constrained `t2.micro` and also hosts PostgreSQL. The initial release therefore runs a single long-polling consumer inside the existing NestJS API process with concurrency `1`, `MaxNumberOfMessages = 1`, and no prefetching. SQS holds the backlog remotely, so queue growth does not grow application memory.

When traffic or instance capacity increases, move the same consumer into a separate PM2 process without changing the SQS message or database contracts.

### Local development

Options, in preference order:

1. Use a development SQS queue.
2. Use LocalStack if offline queue development becomes important.
3. Disable automatic publishing with an environment flag and expose manual job execution only in development.

Do not use an in-memory production queue because jobs disappear on restarts and cannot be shared between processes.

## Configuration

Suggested environment variables:

```text
AUTO_LABELING_ENABLED=true
AUTO_LABELING_QUEUE_URL=
AUTO_LABELING_DLQ_URL=
AUTO_LABELING_WORKER_CONCURRENCY=2
AUTO_LABELING_GEMINI_TIMEOUT_MS=20000
AUTO_LABELING_PENDING_RECOVERY_MINUTES=5
AUTO_LABELING_MAX_LABELS_PER_CARD=6
```

Model name, Vertex project, location, and output-token settings should continue using the existing Google Vertex configuration.

## Security and privacy

- Authenticate all label-management and retry endpoints.
- Verify user ownership for every flashcard and label operation.
- Send only identifiers through SQS.
- Avoid logging definitions, translations, and examples.
- Escape or structurally delimit vocabulary content in the Gemini prompt.
- Treat Gemini output as untrusted input.
- Validate output against the server-owned taxonomy before database writes.
- Rate limit manual retries and bulk-labeling requests.

## Observability

Recommended metrics:

```text
labeling_jobs_published_total
labeling_jobs_completed_total
labeling_jobs_failed_total
labeling_jobs_stale_total
labeling_job_duration_ms
labeling_gemini_duration_ms
labeling_labels_assigned_total
labeling_pending_age_seconds
labeling_dlq_messages
```

Logs should include:

- `flashcardId`.
- `userId` when permitted by the application's logging policy.
- `labelingVersion`.
- SQS message ID.
- Model name.
- Attempt number.
- Result status and duration.

Do not log prompt content by default.

## Testing plan

### Unit tests

- Label name normalization and duplicate prevention.
- Gemini structured-output parsing.
- Rejection of labels outside the taxonomy.
- Maximum label counts.
- Manual labels survive AI relabeling.
- Stale job versions are ignored.
- Reprocessing the same message does not create duplicates.
- Relevant edits increment the labeling version.
- Audio/image edits do not enqueue labeling.

### Integration tests

- Flashcard creation returns while labeling is pending.
- Worker saves valid Gemini labels and completes the job.
- Worker retries provider failures.
- Deleted flashcards are handled successfully.
- Unauthorized labels cannot be assigned or filtered.
- `any` and `all` filters work with book and status filters.
- Due-review queries retain existing spaced-repetition behavior.
- Deleting a label preserves flashcards.

### Deployment tests

- API can publish to SQS.
- Worker can receive and delete messages.
- Failed messages reach the dead-letter queue.
- PM2 restarts the API and its in-process consumer after a process failure.
- Old pending records are recovered and republished.

## Delivery plan

### Phase 1: Manual labels and filtering

- Add label and association entities.
- Add database migration and ownership constraints.
- Add label CRUD endpoints.
- Add assignment endpoint.
- Add label response data to flashcards.
- Add `any` label filtering to normal and due-review queries.
- Add counts to label listing.

Outcome: users can organize and practice vocabulary by manually selected labels without Gemini.

### Phase 2: Gemini classifier

- Define and version the controlled taxonomy.
- Extract or introduce a shared Gemini provider service.
- Implement the classification prompt and JSON schema.
- Add parser, normalization, and validation tests.
- Add labeling status/version fields.

Outcome: classification behavior can be tested synchronously without queue infrastructure.

### Phase 3: Async job processing

- Provision SQS and the dead-letter queue.
- Add the queue publisher.
- Add the in-process, single-concurrency consumer.
- Add stale-version and idempotency handling.
- Add retries, timeouts, and pending-job recovery.
- Enable the consumer in the existing API process.

Outcome: automatic labels are generated without increasing flashcard API latency.

### Phase 4: Frontend integration

- Display manual and AI-suggested labels.
- Display pending, completed, and failed states.
- Add label selection and filtering controls.
- Add practice-by-label flow.
- Add a retry action for failed classifications.

### Phase 5: Hardening and optimization

- Add `all` filtering if it is not part of Phase 1.
- Add batch jobs for imported vocabulary.
- Tune worker concurrency and Gemini quotas.
- Review rejected or removed AI labels to improve the taxonomy.
- Introduce a transactional outbox if required by traffic or reliability targets.
- Add label-based practice analytics if product requirements justify it.

## Acceptance criteria for the first async release

- Creating a flashcard does not wait for Gemini.
- A durable job is created or the flashcard remains recoverably pending.
- Valid AI labels appear on the flashcard after worker completion.
- Manual labels are never removed by the worker.
- Duplicate delivery does not create duplicate associations.
- Old jobs cannot overwrite labels for newer flashcard content.
- Users can filter due cards by label and complete the existing practice flow.
- Provider failures retry and eventually reach a visible failed/DLQ state.
- API and worker expose sufficient logs and metrics to diagnose failures.

## Decisions to confirm before implementation

1. Whether automatic labeling is enabled for every new flashcard or is a per-user preference.
2. The initial controlled topic taxonomy.
3. Whether AI suggestions are immediately active or require user confirmation.
4. Whether Phase 1 needs both `any` and `all` filtering or only `any`.
5. Whether the first deployment uses real development SQS or LocalStack locally.

Recommended defaults:

```text
Auto-label new flashcards: enabled
AI labels immediately usable: yes, visibly marked as AI-generated
Manual labels preserved: always
Initial filter mode: any
Production queue: Amazon SQS
Local development: development SQS queue
```

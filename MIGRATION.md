<!-- @format -->

# Migration Plan: Express + MongoDB to NestJS + PostgreSQL (TypeORM)

## Overview & Goals

- **Goal:** Migrate the existing Express/Mongoose backend (`FLENBE`) to **NestJS** with **PostgreSQL** using **TypeORM**, keeping business logic and external integrations (AWS Translate/Polly, Cloudinary/OpenAI) intact, while improving structure, typing, and reliability.
- **Scope:** API parity for auth, users, books, flashcards, sessions, translation, and GPT features; data migration from MongoDB to Postgres; security hardening; testing and observability upgrades.

## Current System Inventory (from repo)

- **Core:** Express 5, MongoDB via Mongoose, JWT auth with refresh rotation, Cloudinary uploads, AWS Polly/Translate, OpenAI.
- **Entry:** `app.js` wires routers (`/api/auth`, `/api/users`, `/api/bookstore`, `/api/flashcard`, `/api/session`, `/api/translation`), CORS, cookies, jade view, static serving.
- **Middleware:** `authentication.js` verifies JWT from `Authorization` and refresh token from `x-refresh-token` header; sets new access token on refresh.
- **Models:**
  - `User`: name, ava, role enum, birth, email (regex validation), totalscore, streak, password (bcrypt), verificationToken, level_description, scoreADay, IsVerification; pre-save hash; method `compare`.
  - `Token`: `refereshToken` (string), ip, userAgent, `isValid` (string default "true"), `user` ref (ObjectId), timestamps.
  - `Book`: name, `user` ref, `numsofcard` counter, `ava` (image URL).
  - `FlashCard`: `book` ref, `text`, `meaning`, `phonetic`, `example`, `explain`, `box` (spaced repetition bucket), `image`, `lastReviewed`, `nextReviewed`, `correctCount`, `incorrectCount`; unique index on `(text, meaning)`; methods to update review intervals; pre-save increments `Book.numsofcard`; pre-delete decrements.
  - `Session`: `user` ref, `book` ref, `totalquestion`, `score`, `status` enum, `lastStreakUpdate` default to yesterday; timestamps. Pre-save (on updates) adjusts user totalscore, level_description by thresholds, and streak logic based on daily score (`scoreADay`). Statics: `getTodayTotalScore` (aggregation) and `getBooksWithSessionAndCards` (aggregate sessions + books + due flashcards count).
- **Controllers & Routes:**
  - `auth`: login/register/logout/verify/forgot/reset/validate; uses tokens table for refresh; attaches headers `Authorization` + `x-refresh-token`.
  - `users`: `/all`, `/top` leaderboard + ranking.
  - `bookstore`: create with Cloudinary upload; fetch books with sessions and due cards.
  - `flashcard`: CRUD-like + review list, audio playback via Polly (`ReadFlashCard`).
  - `session`: create/update/today total score.
  - `translation`: AWS Translate; `getgpt`: OpenAI chat to extract key words definitions.
- **Integrations:** `config/*` for AWS/Cloudinary/OpenAI; `utils/GetAudio` (Polly), `utils/GetExample` (OpenAI); `utils/jwt` for token creation/headers; `SendVerification`/`SendResetPassword` (email).

## Target Architecture (NestJS)

- **Modules:**
  - `AuthModule` (JWT + refresh, guards, strategies)
  - `UsersModule`
  - `BooksModule`
  - `FlashcardsModule`
  - `SessionsModule`
  - `TranslateModule` (AWS Translate)
  - `AiModule` (OpenAI)
  - `CommonModule` (Config, Logger, Interceptors, Exception Filters)
- **Layers:** Controllers -> DTOs/Validation -> Services -> Repositories (TypeORM) -> Entities.
- **Global:** ValidationPipe (`whitelist`, `forbidNonWhitelisted`, `transform`), CORS, Helmet, Pino logger, API versioning, Swagger.

## Database Mapping (TypeORM Entities)

Use `uuid` primary keys (recommended) or serial integers. Enforce constraints and indices.

### `users`

- `id: uuid pk`
- `name: varchar(30)`
- `ava: text` (default avatar URL)
- `role: enum('student','staff') default 'student'`
- `birth: timestamp` (nullable)
- `email: varchar(255) unique not null`
- `totalscore: int default 0`
- `streak: int default 0`
- `password_hash: varchar(255) not null`
- `verification_token: varchar(255) nullable`
- `level_description: varchar(32) default 'Newbie'`
- `score_a_day: int default 3000`
- `is_verified: boolean default false`
- `created_at/updated_at: timestamps`
- Index: `email` unique.

### `tokens`

- `id: uuid pk`
- `refresh_token_hash: varchar(255) not null`
- `ip: varchar(64)`
- `user_agent: varchar(255)`
- `is_valid: boolean default true`
- `user_id: uuid fk -> users(id)`
- `created_at/updated_at: timestamps`
- Index: `(user_id)`.

### `books`

- `id: uuid pk`
- `name: varchar(255) not null`
- `user_id: uuid fk -> users(id)`
- `num_of_cards: int default 0`
- `ava: text not null`
- `created_at/updated_at`
- Index: `(user_id)`.

### `flashcards`

- `id: uuid pk`
- `book_id: uuid fk -> books(id)`
- `text: varchar(255) not null`
- `meaning: text not null`
- `phonetic: varchar(64) nullable`
- `example: text` (from OpenAI)
- `explain: text`
- `box: int default 1`
- `image: text` (URL)
- `last_reviewed: timestamp default now()`
- `next_reviewed: timestamp default now()`
- `correct_count: int default 0`
- `incorrect_count: int default 0`
- `created_at/updated_at`
- Unique: `(book_id, text, meaning)`
- Indices: `(book_id)`, `(next_reviewed)`.

### `sessions`

- `id: uuid pk`
- `user_id: uuid fk -> users(id)`
- `book_id: uuid fk -> books(id)`
- `total_question: int`
- `score: int nullable`
- `status: enum('pending','finish') default 'pending'`
- `last_streak_update: timestamp default now() - interval '1 day'`
- `created_at/updated_at`
- Indices: `(user_id)`, `(book_id)`, `(created_at)`.

## Business Logic Migration

- **Password hashing:** Use `bcrypt` in `UsersService` on create/update; prefer service-level logic over entity hooks.
- **Book card counters:** Maintain `num_of_cards` via transaction in `FlashcardsService` on create/delete, or derive count via query if consistency is a concern.
- **Spaced repetition:** Port `updateReview`/`updateMultipleReviews` to service functions; compute intervals `[1,2,5,10,20]` days and update `next_reviewed` accordingly in a single transaction.
- **User scoring & streaks:** Move `Session` pre-save logic to `SessionsService.finishSession()` inside a transaction:
  - Update session to `finish` with `score`.
  - Recompute user's `totalscore` and `level_description` thresholds.
  - Compute today's total score via SQL aggregation and update `streak` + `last_streak_update` based on `score_a_day`.
- **Aggregations:**
  - `getTodayTotalScore(userId)`: `SELECT COALESCE(SUM(score),0) FROM sessions WHERE user_id=$1 AND created_at BETWEEN startDay AND endDay;`
  - `getBooksWithSessionAndCards(userId)`: QueryBuilder: latest session per book, join books, count due cards where `next_reviewed < tomorrow`, order by last session date.

## API Migration (Route → Nest Controller)

- `AuthController` → `AuthController` (`POST /auth/login`, `/register`, `/forgotpassword`, `/resetpassword`, `/verifyemail`, `/logout`, `/validate`) with `JwtAuthGuard` + refresh strategy; return tokens in headers to preserve client behavior or migrate to cookie/JSON body.
- `UsersController` → `GET /users/all`, `GET /users/top` with `JwtAuthGuard`.
- `BooksController` → `POST /bookstore/create` (file upload; Cloudinary or S3), `GET /bookstore/all` (use sessions aggregate).
- `FlashcardsController` → `POST /flashcard/create`, `GET /flashcard/bookcard/:bookid`, `GET /flashcard/read/:id` (Polly audio stream), `GET /flashcard/getreview`, `POST /flashcard/checksave`, `DELETE /flashcard/:flashcardid`.
- `SessionsController` → `POST /session/create`, `GET /session/totalscore`, `PATCH /session/updatescore`.
- `TranslationController` → `POST /translation/translate` (AWS Translate) and `POST /translation/getgpt` (OpenAI).

## Auth & Security (Nest)

- Use `@nestjs/jwt`, `passport-jwt` for access tokens; store **hashed** refresh tokens in `tokens` table; rotate refresh token on every login.
- Implement `JwtAuthGuard` and `RefreshTokenGuard` + endpoint for refresh. Preserve header behavior (`Authorization`, `x-refresh-token`) or switch to cookies with `HttpOnly` + CSRF for stateful flows.
- Add `ThrottlerModule` for rate limiting; enable CORS with explicit origins; add Helmet.

## Files & Media

- Keep Cloudinary (existing). Optional: migrate to AWS S3 for tighter AWS integration.
- For Polly audio: stream from Nest using a provider; avoid writing to disk when possible (stream buffer to response). If writing temp files, use a cleanup job.

## External Integrations

- **AWS Translate/Polly:** Wrap SDK clients in injectable services; read credentials from `ConfigModule`; avoid `process.exit(1)` at module import—throw handled errors on use.
- **OpenAI:** Wrap client, validate JSON responses, enforce token limits.

## Configuration & Environment

- `@nestjs/config` with `joi` validation; `.env.development`, `.env.test`, `.env.production`.
- Do not read `process.env` directly in services; inject `ConfigService`.
- Example validation schema: require DB URL/credentials, JWT secret, Cloudinary/S3 keys, AWS keys, OpenAI key.

## Data Migration Plan (Mongo → Postgres)

1. **Freeze writes** during final sync; run initial bulk migration during downtime window.
2. **ID Strategy:**
   - Generate UUIDs in Postgres; maintain an **ID mapping** (`mongo_id → uuid`) per collection to preserve relationships.
   - Alternatively, store original `mongo_id` as a separate column for traceability.
3. **ETL Script (Node.js):**
   - Connect to MongoDB and Postgres.
   - Migrate in dependency order: `users` → `tokens` → `books` → `flashcards` → `sessions`.
   - For each document:
     - Create target row with mapped FK uuids.
     - Transform fields (e.g., `verficationToken` → `verification_token`, `IsVerification` → `is_verified`).
     - Hash refresh tokens before storing.
   - Recompute counters if desired (`num_of_cards`) or carry over values.
4. **Consistency:** Wrap per-user migrations in transactions; batch in chunks (e.g., 1000 records) to avoid memory pressure.
5. **Validation:** After migration, run verification queries (counts, sums, unique constraints) and spot-check sample users/books.
6. **Cutover:** Point API to new DB; keep a backfill job for late writes or perform a final delta sync.

### Example: ETL Pseudocode

```ts
// pseudo-code (run as a standalone script)
for (const user of mongo.users.find({})) {
  const uuid = genUuid();
  userMap[user._id] = uuid;
  await pg.users.insert({ id: uuid, ...transformUser(user) });
}
for (const book of mongo.books.find({})) {
  const uuid = genUuid();
  bookMap[book._id] = uuid;
  await pg.books.insert({
    id: uuid,
    user_id: userMap[book.user],
    ...transformBook(book),
  });
}
for (const fc of mongo.flashcards.find({})) {
  const uuid = genUuid();
  await pg.flashcards.insert({
    id: uuid,
    book_id: bookMap[fc.book],
    ...transformFlashcard(fc),
  });
}
for (const s of mongo.sessions.find({})) {
  const uuid = genUuid();
  await pg.sessions.insert({
    id: uuid,
    user_id: userMap[s.user],
    book_id: bookMap[s.book],
    ...transformSession(s),
  });
}
```

## Testing & Verification

- **Unit tests:** Services (auth, sessions, flashcards) with mocked repos.
- **E2E tests:** Supertest against Nest app; seed Postgres test DB.
- **Data checks:**
  - User totalscore/streak logic correctness across edge dates.
  - Unique constraint across `(book_id, text, meaning)`.
  - `getreview` returns due cards based on `next_reviewed`.
  - Audio streaming returns valid `audio/mpeg` and handles cleanup.

## CI/CD & Ops

- Dockerize Nest app (multi-stage `node:18-alpine`, `npm ci`).
- Run migrations via TypeORM CLI at deploy; use environment-specific configs.
- Health endpoints `/health`, `/ready`; structured JSON logs (Pino).
- Secrets via environment/secret manager; no secrets in code.

## Phased Timeline

1. Scaffold Nest app + TypeORM + Config + basic modules.
2. Implement entities and repositories; wire controllers for read-only endpoints.
3. Port auth + JWT guards + refresh handling.
4. Port write endpoints (books, flashcards, sessions) with transactions.
5. Wrap AWS/Cloudinary/OpenAI providers.
6. ETL data migration; validate; cutover.
7. E2E tests, observability, performance tuning.

## Sample TypeORM Entity Stubs (for reference)

```ts
// users.entity.ts
@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ length: 30 }) name: string;
  @Column({ type: "text", default: "https://.../avatar-default-icon.png" })
  ava: string;
  @Column({ type: "enum", enum: ["student", "staff"], default: "student" })
  role: "student" | "staff";
  @Column({ type: "timestamp", nullable: true }) birth?: Date;
  @Column({ length: 255, unique: true }) email: string;
  @Column({ default: 0 }) totalscore: number;
  @Column({ default: 0 }) streak: number;
  @Column({ name: "password_hash", length: 255 }) passwordHash: string;
  @Column({ name: "verification_token", nullable: true })
  verificationToken?: string;
  @Column({ default: "Newbie" }) level_description: string;
  @Column({ name: "score_a_day", default: 3000 }) scoreADay: number;
  @Column({ name: "is_verified", default: false }) isVerified: boolean;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

// tokens.entity.ts
@Entity("tokens")
export class Token {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ name: "refresh_token_hash", length: 255 }) refreshTokenHash: string;
  @Column({ length: 64 }) ip: string;
  @Column({ name: "user_agent", length: 255 }) userAgent: string;
  @Column({ name: "is_valid", default: true }) isValid: boolean;
  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

// books.entity.ts
@Entity("books")
export class Book {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ length: 255 }) name: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
  @Column({ name: "num_of_cards", default: 0 }) numOfCards: number;
  @Column({ type: "text" }) ava: string;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

// flashcards.entity.ts
@Entity("flashcards")
@Unique(["book", "text", "meaning"])
export class FlashCard {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => Book)
  @JoinColumn({ name: "book_id" })
  book: Book;
  @Column({ length: 255 }) text: string;
  @Column({ type: "text" }) meaning: string;
  @Column({ length: 64, nullable: true }) phonetic?: string;
  @Column({ type: "text", nullable: true }) example?: string;
  @Column({ type: "text", nullable: true }) explain?: string;
  @Column({ default: 1 }) box: number;
  @Column({ type: "text", default: "" }) image: string;
  @Column({ type: "timestamp", default: () => "now()" }) lastReviewed: Date;
  @Column({ type: "timestamp", default: () => "now()" }) nextReviewed: Date;
  @Column({ default: 0 }) correctCount: number;
  @Column({ default: 0 }) incorrectCount: number;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}

// sessions.entity.ts
@Entity("sessions")
export class Session {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
  @ManyToOne(() => Book)
  @JoinColumn({ name: "book_id" })
  book: Book;
  @Column({ name: "total_question", nullable: true }) totalQuestion?: number;
  @Column({ nullable: true }) score?: number;
  @Column({ type: "enum", enum: ["pending", "finish"], default: "pending" })
  status: "pending" | "finish";
  @Column({
    name: "last_streak_update",
    type: "timestamp",
    default: () => "(now() - interval '1 day')",
  })
  lastStreakUpdate: Date;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
```

## Setup Commands (reference)

```bash
# NestJS scaffolding
npm i -g @nestjs/cli
nest new backend
cd backend

# Dependencies
npm i @nestjs/typeorm typeorm pg @nestjs/config class-validator class-transformer @nestjs/jwt passport-jwt passport @nestjs/throttler helmet nestjs-pino

# Dev tools
npm i -D @nestjs/testing supertest eslint prettier husky lint-staged
```

## Next Steps

- Confirm entity fields and constraints match your business rules.
- I can scaffold the NestJS project, generate these entities, wire modules/services, and draft the ETL script to migrate data from MongoDB to Postgres.

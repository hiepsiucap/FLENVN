import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema1722519900000 implements MigrationInterface {
  name = 'CreateInitialSchema1722519900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tokens_type_enum" AS ENUM ('refresh', 'email-verification', 'password-reset');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "flashcards_partOfSpeech_enum" AS ENUM (
          'noun',
          'verb',
          'adjective',
          'adverb',
          'pronoun',
          'preposition',
          'conjunction',
          'interjection',
          'determiner'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "flashcards_status_enum" AS ENUM ('new', 'learning', 'reviewing', 'mastered');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sessions_type_enum" AS ENUM ('review', 'learn', 'practice');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "sessions_result_enum" AS ENUM ('correct', 'incorrect', 'skipped');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar NOT NULL,
        "password" varchar NOT NULL,
        "username" varchar,
        "avatar" varchar NOT NULL DEFAULT 'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/profile.jpg',
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "emailVerificationToken" varchar,
        "passwordResetToken" varchar,
        "passwordResetExpires" timestamp,
        "level" integer NOT NULL DEFAULT 1,
        "exp" integer NOT NULL DEFAULT 0,
        "streak" integer NOT NULL DEFAULT 0,
        "lastActive" timestamp,
        "isActive" boolean NOT NULL DEFAULT true,
        "isAdmin" boolean NOT NULL DEFAULT false,
        "booksCount" integer NOT NULL DEFAULT 0,
        "totalWordsUsed" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" text,
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "maxBooks" integer NOT NULL DEFAULT 5,
        "maxWords" integer NOT NULL DEFAULT 50000,
        "maxFlashcards" integer NOT NULL DEFAULT 100,
        "features" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subscription_plans_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "token" varchar NOT NULL,
        "type" "tokens_type_enum" NOT NULL DEFAULT 'refresh',
        "expiresAt" timestamp NOT NULL,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        CONSTRAINT "FK_tokens_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "books" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "title" varchar NOT NULL,
        "description" text,
        "coverImage" varchar DEFAULT 'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/logo.png',
        "content" text,
        "fileUrl" varchar,
        "wordCount" integer NOT NULL DEFAULT 0,
        "totalCards" integer NOT NULL DEFAULT 0,
        "isPublic" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_books_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "flashcards" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "word" varchar NOT NULL,
        "partOfSpeech" "flashcards_partOfSpeech_enum",
        "pronunciation" varchar,
        "definition" text,
        "translation" text,
        "audioUrl" varchar,
        "imageUrl" varchar DEFAULT 'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/logo.png',
        "example" text,
        "exampleAudioUrl" varchar,
        "exampleTranslation" text,
        "easeFactor" double precision NOT NULL DEFAULT 2.5,
        "interval" integer NOT NULL DEFAULT 0,
        "repetitions" integer NOT NULL DEFAULT 0,
        "nextReviewDate" timestamp,
        "status" "flashcards_status_enum" NOT NULL DEFAULT 'new',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "bookId" uuid,
        CONSTRAINT "FK_flashcards_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_flashcards_bookId_books_id" FOREIGN KEY ("bookId") REFERENCES "books"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "planId" uuid NOT NULL,
        "startDate" date NOT NULL,
        "endDate" date,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_user_subscriptions_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_subscriptions_planId_subscription_plans_id" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" "sessions_type_enum" NOT NULL,
        "result" "sessions_result_enum" NOT NULL,
        "responseTime" integer,
        "score" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        "flashcardId" uuid NOT NULL,
        CONSTRAINT "FK_sessions_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_sessions_flashcardId_flashcards_id" FOREIGN KEY ("flashcardId") REFERENCES "flashcards"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "practice_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "bookId" uuid,
        "totalFlashcards" integer NOT NULL DEFAULT 0,
        "totalGames" integer NOT NULL DEFAULT 0,
        "correctGames" integer NOT NULL DEFAULT 0,
        "incorrectGames" integer NOT NULL DEFAULT 0,
        "skippedGames" integer NOT NULL DEFAULT 0,
        "score" integer NOT NULL DEFAULT 0,
        "accuracy" double precision NOT NULL DEFAULT 0,
        "durationMs" integer,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "userId" uuid NOT NULL,
        CONSTRAINT "FK_practice_sessions_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_practice_sessions_bookId_books_id" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "practice_game_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "gameType" varchar NOT NULL,
        "result" "sessions_result_enum" NOT NULL,
        "responseTime" integer,
        "score" integer NOT NULL DEFAULT 0,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "practiceSessionId" uuid NOT NULL,
        "flashcardId" uuid NOT NULL,
        CONSTRAINT "FK_practice_game_results_practiceSessionId_practice_sessions_id" FOREIGN KEY ("practiceSessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_practice_game_results_flashcardId_flashcards_id" FOREIGN KEY ("flashcardId") REFERENCES "flashcards"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_books_createdAt" ON "books" ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_flashcards_word" ON "flashcards" ("word")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_flashcards_userId_word" ON "flashcards" ("userId", "word")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_sessions_createdAt" ON "sessions" ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_practice_sessions_createdAt" ON "practice_sessions" ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_practice_game_results_createdAt" ON "practice_game_results" ("createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "practice_game_results"');
    await queryRunner.query('DROP TABLE IF EXISTS "practice_sessions"');
    await queryRunner.query('DROP TABLE IF EXISTS "sessions"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_subscriptions"');
    await queryRunner.query('DROP TABLE IF EXISTS "flashcards"');
    await queryRunner.query('DROP TABLE IF EXISTS "books"');
    await queryRunner.query('DROP TABLE IF EXISTS "tokens"');
    await queryRunner.query('DROP TABLE IF EXISTS "subscription_plans"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
    await queryRunner.query('DROP TYPE IF EXISTS "sessions_result_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "sessions_type_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "flashcards_status_enum"');
    await queryRunner.query(
      'DROP TYPE IF EXISTS "flashcards_partOfSpeech_enum"',
    );
    await queryRunner.query('DROP TYPE IF EXISTS "tokens_type_enum"');
  }
}

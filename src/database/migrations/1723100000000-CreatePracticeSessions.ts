import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePracticeSessions1723100000000 implements MigrationInterface {
  name = 'CreatePracticeSessions1723100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      'CREATE INDEX IF NOT EXISTS "IDX_practice_sessions_createdAt" ON "practice_sessions" ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_practice_game_results_createdAt" ON "practice_game_results" ("createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "practice_game_results"');
    await queryRunner.query('DROP TABLE IF EXISTS "practice_sessions"');
  }
}

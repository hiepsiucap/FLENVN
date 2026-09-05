import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAsyncVocabularyLabels1723160000000 implements MigrationInterface {
  name = 'AddAsyncVocabularyLabels1723160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "labels_type_enum" AS ENUM ('topic', 'level', 'usage', 'custom');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "flashcard_labels_source_enum" AS ENUM ('manual', 'gemini', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "flashcards_labelingStatus_enum" AS ENUM ('pending', 'processing', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "labels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "normalizedName" varchar(50) NOT NULL,
        "type" "labels_type_enum" NOT NULL DEFAULT 'custom',
        "color" varchar(7),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_labels_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_labels_userId_normalizedName" UNIQUE ("userId", "normalizedName")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "flashcard_labels" (
        "flashcardId" uuid NOT NULL,
        "labelId" uuid NOT NULL,
        "source" "flashcard_labels_source_enum" NOT NULL,
        "confirmedByUser" boolean NOT NULL DEFAULT false,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_flashcard_labels" PRIMARY KEY ("flashcardId", "labelId"),
        CONSTRAINT "FK_flashcard_labels_flashcardId_flashcards_id" FOREIGN KEY ("flashcardId") REFERENCES "flashcards"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_flashcard_labels_labelId_labels_id" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "flashcards"
      ADD COLUMN IF NOT EXISTS "labelingStatus" "flashcards_labelingStatus_enum" NOT NULL DEFAULT 'completed',
      ADD COLUMN IF NOT EXISTS "labelingVersion" integer NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS "labelingAttempts" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "labelingQueuedAt" timestamp,
      ADD COLUMN IF NOT EXISTS "labeledAt" timestamp
    `);
    await queryRunner.query(`
      UPDATE "flashcards"
      SET "labeledAt" = COALESCE("labeledAt", "updatedAt")
      WHERE "labelingStatus" = 'completed'
    `);
    await queryRunner.query(`
      ALTER TABLE "flashcards"
      ALTER COLUMN "labelingStatus" SET DEFAULT 'pending'
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_labels_userId_type" ON "labels" ("userId", "type")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_flashcard_labels_labelId" ON "flashcard_labels" ("labelId")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_flashcards_labeling_recovery" ON "flashcards" ("labelingStatus", "labelingQueuedAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_flashcards_labeling_recovery"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "flashcard_labels"');
    await queryRunner.query('DROP TABLE IF EXISTS "labels"');
    await queryRunner.query(`
      ALTER TABLE "flashcards"
      DROP COLUMN IF EXISTS "labeledAt",
      DROP COLUMN IF EXISTS "labelingQueuedAt",
      DROP COLUMN IF EXISTS "labelingAttempts",
      DROP COLUMN IF EXISTS "labelingVersion",
      DROP COLUMN IF EXISTS "labelingStatus"
    `);
    await queryRunner.query(
      'DROP TYPE IF EXISTS "flashcards_labelingStatus_enum"',
    );
    await queryRunner.query(
      'DROP TYPE IF EXISTS "flashcard_labels_source_enum"',
    );
    await queryRunner.query('DROP TYPE IF EXISTS "labels_type_enum"');
  }
}

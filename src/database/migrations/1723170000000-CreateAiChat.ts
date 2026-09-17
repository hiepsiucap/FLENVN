import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiChat1723170000000 implements MigrationInterface {
  name = 'CreateAiChat1723170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "ai_messages_role_enum" AS ENUM ('user', 'assistant');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "title" varchar(120) NOT NULL DEFAULT 'New conversation',
        "targetLanguage" varchar(10) NOT NULL DEFAULT 'en',
        "englishLevel" varchar(10),
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ai_conversations_userId_users_id"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_ai_conversations_englishLevel"
          CHECK ("englishLevel" IS NULL OR "englishLevel" IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "conversationId" uuid NOT NULL,
        "role" "ai_messages_role_enum" NOT NULL,
        "content" text NOT NULL,
        "clientMessageId" uuid,
        "replyToMessageId" uuid,
        "model" varchar(100),
        "inputTokens" integer,
        "outputTokens" integer,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_ai_messages_conversationId_ai_conversations_id"
          FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ai_messages_replyToMessageId_ai_messages_id"
          FOREIGN KEY ("replyToMessageId") REFERENCES "ai_messages"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_ai_conversations_userId_updatedAt" ON "ai_conversations" ("userId", "updatedAt" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_ai_messages_conversationId_createdAt" ON "ai_messages" ("conversationId", "createdAt" DESC, "id" DESC)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_messages_clientMessageId" ON "ai_messages" ("conversationId", "clientMessageId") WHERE "clientMessageId" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ai_messages_replyToMessageId" ON "ai_messages" ("replyToMessageId") WHERE "replyToMessageId" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "ai_messages"');
    await queryRunner.query('DROP TABLE IF EXISTS "ai_conversations"');
    await queryRunner.query('DROP TYPE IF EXISTS "ai_messages_role_enum"');
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateListeningSets1723280000000 implements MigrationInterface {
  name = 'CreateListeningSets1723280000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "listening_sets" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "cacheKey" varchar(64) NOT NULL,
      "game" varchar(24) NOT NULL,
      "difficulty" varchar(10) NOT NULL,
      "status" varchar(12) NOT NULL DEFAULT 'generating',
      "questions" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "PK_listening_sets" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_listening_sets_user_cache" UNIQUE ("userId","cacheKey")
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "listening_sets"');
  }
}

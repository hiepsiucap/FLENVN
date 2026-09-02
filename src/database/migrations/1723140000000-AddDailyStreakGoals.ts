import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDailyStreakGoals1723140000000 implements MigrationInterface {
  name = 'AddDailyStreakGoals1723140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "longestStreak" integer NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dailyScoreTarget" integer NOT NULL DEFAULT 100',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pendingDailyScoreTarget" integer',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "targetEffectiveDate" date',
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" varchar NOT NULL DEFAULT 'Asia/Bangkok'`,
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastStreakDate" date',
    );
    await queryRunner.query(
      'UPDATE "users" SET "longestStreak" = "streak" WHERE "longestStreak" < "streak"',
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_daily_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "localDate" date NOT NULL,
        "earnedScore" integer NOT NULL DEFAULT 0,
        "targetScore" integer NOT NULL,
        "completedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_daily_progress" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_daily_progress_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_user_daily_progress_user_date" UNIQUE ("userId", "localDate")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "user_daily_progress"');
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "lastStreakDate"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "timezone"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "targetEffectiveDate"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "pendingDailyScoreTarget"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "dailyScoreTarget"',
    );
    await queryRunner.query(
      'ALTER TABLE "users" DROP COLUMN IF EXISTS "longestStreak"',
    );
  }
}

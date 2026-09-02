import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillLegacyStreakDates1723150000000 implements MigrationInterface {
  name = 'BackfillLegacyStreakDates1723150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET "lastStreakDate" = "lastActive"::date,
          "longestStreak" = GREATEST("longestStreak", "streak")
      WHERE "streak" > 0
        AND "lastActive" IS NOT NULL
        AND "lastStreakDate" IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Legacy streak dates cannot be distinguished safely after new progress exists.
  }
}

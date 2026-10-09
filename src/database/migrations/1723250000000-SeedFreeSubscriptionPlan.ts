import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedFreeSubscriptionPlan1723250000000
  implements MigrationInterface
{
  name = 'SeedFreeSubscriptionPlan1723250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "subscription_plans"
        ("name", "description", "price", "maxBooks", "maxWords", "maxFlashcards", "features", "isActive")
      VALUES
        ('Free', 'Default free plan', 0, 20, 10000, 100, '{}'::jsonb, true)
      ON CONFLICT ("name") DO UPDATE
      SET "maxBooks" = EXCLUDED."maxBooks",
          "maxWords" = EXCLUDED."maxWords"
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Keep plans that may already have users or administrator changes.
  }
}

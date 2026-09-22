import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateImageMigrationAudit1723200000000 implements MigrationInterface {
  name = 'CreateImageMigrationAudit1723200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "image_migration_audit" (
        "id" bigserial PRIMARY KEY,
        "entityType" varchar NOT NULL,
        "recordId" uuid NOT NULL,
        "oldUrl" text NOT NULL,
        "newUrl" text NOT NULL,
        "objectKey" varchar NOT NULL,
        "migratedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_image_migration_audit_record"
      ON "image_migration_audit" ("entityType", "recordId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "image_migration_audit"');
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileUrlToBooks1723110000000 implements MigrationInterface {
  name = 'AddFileUrlToBooks1723110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "fileUrl" varchar',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "books" DROP COLUMN IF EXISTS "fileUrl"',
    );
  }
}

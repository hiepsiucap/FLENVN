import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveAuthorFromBooks1723130000000 implements MigrationInterface {
  name = 'RemoveAuthorFromBooks1723130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "books" DROP COLUMN IF EXISTS "author"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "author" varchar',
    );
  }
}

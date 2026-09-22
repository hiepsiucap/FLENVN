import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManagedImageKeys1723190000000 implements MigrationInterface {
  name = 'AddManagedImageKeys1723190000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "imageKey" varchar',
    );
    await queryRunner.query(
      'ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "coverImageKey" varchar',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "books" DROP COLUMN IF EXISTS "coverImageKey"',
    );
    await queryRunner.query(
      'ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "imageKey"',
    );
  }
}

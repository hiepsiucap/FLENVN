import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExampleAudioUrlToFlashcards1723090000000 implements MigrationInterface {
  name = 'AddExampleAudioUrlToFlashcards1723090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "exampleAudioUrl" varchar',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "flashcards" DROP COLUMN IF EXISTS "exampleAudioUrl"',
    );
  }
}

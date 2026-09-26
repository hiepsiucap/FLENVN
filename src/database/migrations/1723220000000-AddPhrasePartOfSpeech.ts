import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhrasePartOfSpeech1723220000000 implements MigrationInterface {
  name = 'AddPhrasePartOfSpeech1723220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TYPE "flashcards_partOfSpeech_enum" ADD VALUE IF NOT EXISTS \'phrase\'',
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL cannot remove an enum value without recreating the type.
  }
}

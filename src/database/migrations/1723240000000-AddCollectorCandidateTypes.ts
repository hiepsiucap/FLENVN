import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCollectorCandidateTypes1723240000000 implements MigrationInterface {
  name = 'AddCollectorCandidateTypes1723240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of [
      'phrasal_verb',
      'collocation',
      'idiom',
      'sentence_pattern',
    ]) {
      await queryRunner.query(
        `ALTER TYPE "flashcards_partOfSpeech_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(): Promise<void> {
    // PostgreSQL enum values cannot be removed without replacing the type.
  }
}

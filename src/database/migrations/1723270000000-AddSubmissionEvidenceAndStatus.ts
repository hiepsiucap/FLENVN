import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmissionEvidenceAndStatus1723270000000 implements MigrationInterface {
  name = 'AddSubmissionEvidenceAndStatus1723270000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD COLUMN "evidenceImageUrl" varchar(1000)`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD CONSTRAINT "CHK_submissions_status" CHECK ("status" IN ('pending', 'in_review', 'resolved', 'rejected'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP CONSTRAINT "CHK_submissions_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" DROP COLUMN "evidenceImageUrl"`,
    );
    await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "status"`);
  }
}

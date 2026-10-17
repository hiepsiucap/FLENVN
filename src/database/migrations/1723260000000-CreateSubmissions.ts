import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubmissions1723260000000 implements MigrationInterface {
  name = 'CreateSubmissions1723260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "submissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "subject" varchar(150),
        "message" text NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_submissions_userId_users_id" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_submissions_type" CHECK ("type" IN ('feedback', 'report'))
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_submissions_createdAt" ON "submissions" ("createdAt")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "submissions"');
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParentBookToBooks1723230000000 implements MigrationInterface {
  name = 'AddParentBookToBooks1723230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "books" ADD COLUMN "parentBookId" uuid',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_books_parentBookId" ON "books" ("parentBookId")',
    );
    await queryRunner.query(
      'ALTER TABLE "books" ADD CONSTRAINT "FK_books_parentBookId" FOREIGN KEY ("parentBookId") REFERENCES "books"("id") ON DELETE RESTRICT',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "books" DROP CONSTRAINT "FK_books_parentBookId"',
    );
    await queryRunner.query('DROP INDEX "IDX_books_parentBookId"');
    await queryRunner.query('ALTER TABLE "books" DROP COLUMN "parentBookId"');
  }
}

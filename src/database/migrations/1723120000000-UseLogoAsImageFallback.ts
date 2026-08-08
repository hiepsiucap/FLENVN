import { MigrationInterface, QueryRunner } from 'typeorm';

const LOGO_URL =
  'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/logo.png';
const OLD_BOOK_IMAGE_URL =
  'https://flenvn.s3.ap-southeast-1.amazonaws.com/images/book.png';

export class UseLogoAsImageFallback1723120000000 implements MigrationInterface {
  name = 'UseLogoAsImageFallback1723120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" ALTER COLUMN "coverImage" SET DEFAULT '${LOGO_URL}'`,
    );
    await queryRunner.query(
      `UPDATE "books" SET "coverImage" = '${LOGO_URL}' WHERE "coverImage" IS NULL OR "coverImage" = '${OLD_BOOK_IMAGE_URL}'`,
    );

    await queryRunner.query(
      `ALTER TABLE "flashcards" ALTER COLUMN "imageUrl" SET DEFAULT '${LOGO_URL}'`,
    );
    await queryRunner.query(
      `UPDATE "flashcards" SET "imageUrl" = '${LOGO_URL}' WHERE "imageUrl" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "books" ALTER COLUMN "coverImage" SET DEFAULT '${OLD_BOOK_IMAGE_URL}'`,
    );
    await queryRunner.query(
      'ALTER TABLE "flashcards" ALTER COLUMN "imageUrl" DROP DEFAULT',
    );
  }
}
